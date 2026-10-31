// Chat view: a webview in the DeepSeek Harness sidebar that talks to `deepseek-harness acp`
// (dsh's ACP profile) — one agent process per workspace folder, one session per chat.
const vscode = require('vscode');
const crypto = require('crypto');
const os = require('os');
const path = require('path');
const { AcpClient } = require('./acp');

const t = vscode.l10n.t;

function webviewStrings() {
  return {
    placeholder: t('Ask DeepSeek Harness… (Enter to send, Shift+Enter for a new line)'),
    send: t('Send'),
    stop: t('Stop'),
    working: t('Working…'),
    starting: t('Starting the agent…'),
    thinking: t('Thinking'),
    output: t('Output'),
    empty: t('Start a conversation. The agent works in:'),
    context: t('Current file is attached; click to toggle'),
    contextOff: t('Current file is not attached; click to attach'),
    permission: t('Permission requested'),
    cancelled: t('Cancelled'),
    stopped: t('Stopped: {0}'),
    contextUsage: t('Context: {0} of {1}'),
  };
}

class ChatViewProvider {
  constructor(context, options) {
    this.context = context;
    this.launcher = options.launcher;
    this.workspaceDir = options.workspaceDir;
    this.output = options.output;
    this.view = undefined;
    this.client = undefined;
    this.clientDir = undefined;
    this.session = undefined;
    this.starting = undefined;
    this.busy = false;
    this.permissions = new Map();
    this.attachFile = true;
    this.onDidChangeBusy = new vscode.EventEmitter();

    context.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor(() => this.postContext()),
      vscode.window.onDidChangeTextEditorSelection(() => this.postContext()),
      { dispose: () => this.dispose() }
    );
  }

  resolveWebviewView(view) {
    this.view = view;
    const media = vscode.Uri.joinPath(this.context.extensionUri, 'media');
    view.webview.options = { enableScripts: true, localResourceRoots: [media] };
    view.webview.html = this.html(view.webview, media);
    view.webview.onDidReceiveMessage((message) => this.onMessage(message));
    view.onDidDispose(() => {
      this.view = undefined;
    });
  }

  post(message) {
    if (this.view) this.view.webview.postMessage(message);
  }

  reveal() {
    vscode.commands.executeCommand('deepseekHarness.chat.focus');
  }

  postState() {
    this.post({
      type: 'state',
      busy: this.busy,
      starting: Boolean(this.starting),
      cwd: this.session ? this.session.cwd : this.workspaceDir() || os.homedir(),
      configOptions: this.session ? this.session.configOptions : [],
    });
  }

  // The active file (and selected lines) travels with each prompt as an ACP resource link.
  currentFileContext() {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.uri.scheme !== 'file') return undefined;
    const { start, end } = editor.selection;
    const lines = editor.selection.isEmpty ? '' : `:${start.line + 1}-${end.line + 1}`;
    const fragment = editor.selection.isEmpty ? '' : `#L${start.line + 1}-${end.line + 1}`;
    return {
      name: `${path.basename(editor.document.uri.fsPath)}${lines}`,
      uri: `${editor.document.uri.toString()}${fragment}`,
    };
  }

  postContext() {
    this.post({ type: 'context', file: this.currentFileContext(), attach: this.attachFile });
  }

  async onMessage(message) {
    switch (message.type) {
      case 'ready':
        this.post({ type: 'strings', strings: webviewStrings() });
        this.postState();
        this.postContext();
        this.ensureSession().catch((error) => this.fail(error));
        break;
      case 'send':
        await this.prompt(message.text);
        break;
      case 'cancel':
        this.cancel();
        break;
      case 'setConfig':
        await this.setConfig(message.configId, message.value);
        break;
      case 'permission':
        this.answerPermission(message.requestId, message.optionId);
        break;
      case 'toggleContext':
        this.attachFile = !this.attachFile;
        this.postContext();
        break;
    }
  }

  async ensureSession() {
    if (this.session && this.client && this.client.running) return this.session;
    if (!this.starting) {
      this.starting = this.startSession().finally(() => {
        this.starting = undefined;
        this.postState();
      });
      this.postState();
    }
    return this.starting;
  }

  async startSession() {
    const dir = this.workspaceDir() || os.homedir();
    if (!this.client || !this.client.running || this.clientDir !== dir) {
      this.disposeClient();
      this.client = this.createClient(dir);
      this.clientDir = dir;
      await this.client.start({ name: 'deepseek-harness-desktop', version: this.context.extension.packageJSON.version });
    }
    const result = await this.client.request('session/new', { cwd: dir, mcpServers: [] });
    this.session = { id: result.sessionId, cwd: dir, configOptions: result.configOptions || [] };
    return this.session;
  }

  createClient(dir) {
    const client = new AcpClient(this.launcher(), ['acp', '--dir', dir], {
      cwd: dir,
      env: { ...process.env, DSH_DESKTOP_CLIENT: 'vscode' },
    });
    client.on('stderr', (text) => this.output.append(text));
    client.on('update', (params) => this.onUpdate(client, params));
    client.on('permission', (request) => this.onPermission(client, request));
    client.on('exit', (info) => {
      if (this.client !== client) return;
      this.output.appendLine(`[agent exited: ${info.signal || info.code}]`);
      this.client = undefined;
      this.session = undefined;
      this.setBusy(false);
      this.post({ type: 'notice', kind: 'error', text: t('The agent stopped. Send a message to start it again; details in the "DeepSeek Harness" output.') });
      this.postState();
    });
    return client;
  }

  onUpdate(client, params) {
    if (client !== this.client || !this.session || params.sessionId !== this.session.id) return;
    const update = params.update;
    if (update.sessionUpdate === 'config_option_update' && update.configOptions) {
      this.session.configOptions = update.configOptions;
      this.postState();
      return;
    }
    this.post({ type: 'update', update });
  }

  onPermission(client, { params, respond }) {
    if (client !== this.client) {
      respond({ outcome: 'cancelled' });
      return;
    }
    const requestId = crypto.randomUUID();
    this.permissions.set(requestId, respond);
    this.post({ type: 'permission', requestId, toolCall: params.toolCall, options: params.options });
    this.reveal();
  }

  answerPermission(requestId, optionId) {
    const respond = this.permissions.get(requestId);
    if (!respond) return;
    this.permissions.delete(requestId);
    respond(optionId ? { outcome: 'selected', optionId } : { outcome: 'cancelled' });
  }

  cancelPermissions() {
    for (const [requestId, respond] of this.permissions) {
      respond({ outcome: 'cancelled' });
      this.post({ type: 'permissionClosed', requestId });
    }
    this.permissions.clear();
  }

  setBusy(busy) {
    this.busy = busy;
    this.onDidChangeBusy.fire(busy);
    this.postState();
  }

  async prompt(text) {
    if (this.busy || !text || !text.trim()) return;
    const prompt = [{ type: 'text', text }];
    const file = this.attachFile ? this.currentFileContext() : undefined;
    if (file) prompt.push({ type: 'resource_link', name: file.name, uri: file.uri });
    this.setBusy(true);
    let session;
    try {
      session = await this.ensureSession();
      const result = await this.client.request('session/prompt', { sessionId: session.id, prompt });
      // A turn that ends after "New chat" belongs to the old transcript; drop its outcome.
      if (this.session === session) this.post({ type: 'turnEnd', stopReason: result.stopReason });
    } catch (error) {
      if (!session || this.session === session) this.fail(error);
    } finally {
      this.setBusy(false);
    }
  }

  cancel() {
    this.cancelPermissions();
    if (this.client && this.session) this.client.notify('session/cancel', { sessionId: this.session.id });
  }

  async newChat() {
    this.cancel();
    const { client, session } = this;
    this.session = undefined;
    this.post({ type: 'reset' });
    if (client && session) client.request('session/close', { sessionId: session.id }).catch(() => {});
    await this.ensureSession().catch((error) => this.fail(error));
  }

  async setConfig(configId, value) {
    if (!this.session || !this.client) return;
    try {
      const result = await this.client.request('session/set_config_option', { sessionId: this.session.id, configId, value });
      this.session.configOptions = result.configOptions || this.session.configOptions;
    } catch (error) {
      this.fail(error);
    }
    this.postState();
  }

  fail(error) {
    const message = error && error.code === 'ENOENT'
      ? t('Launcher not found at {0}. Run install.sh from deepseek-harness-desktop.', this.launcher())
      : (error && error.message) || String(error);
    this.output.appendLine(`[error] ${message}`);
    this.post({ type: 'notice', kind: 'error', text: message });
  }

  disposeClient() {
    this.cancelPermissions();
    if (this.client) this.client.dispose();
    this.client = undefined;
    this.session = undefined;
  }

  dispose() {
    this.disposeClient();
  }

  html(webview, media) {
    const nonce = crypto.randomBytes(16).toString('base64');
    const css = webview.asWebviewUri(vscode.Uri.joinPath(media, 'chat.css'));
    const js = webview.asWebviewUri(vscode.Uri.joinPath(media, 'chat.js'));
    return `<!DOCTYPE html>
<html lang="${vscode.env.language}">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="${css}">
<title>DeepSeek Harness</title>
</head>
<body>
<header id="toolbar"></header>
<main id="transcript" aria-live="polite"></main>
<footer id="composer"></footer>
<script nonce="${nonce}" src="${js}"></script>
</body>
</html>`;
  }
}

module.exports = { ChatViewProvider };
