// DeepSeek Harness Desktop: a chat view in the sidebar backed by the dsh installed on this computer
// (over ACP), plus commands for its web app — all through the same launcher the application menu uses.
const vscode = require('vscode');
const { execFile } = require('child_process');
const os = require('os');
const { ChatViewProvider } = require('./chat');

const STATUS_INTERVAL_MS = 20000;
const t = vscode.l10n.t;

function launcher() {
  const path = vscode.workspace.getConfiguration('deepseekHarness').get('launcherPath');
  return (path || '~/.local/bin/deepseek-harness').replace(/^~(?=\/|$)/, os.homedir());
}

// Folder of the active file; otherwise the first workspace folder.
function workspaceDir() {
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    const folder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
    if (folder) return folder.uri.fsPath;
  }
  const folders = vscode.workspace.workspaceFolders;
  return folders && folders.length ? folders[0].uri.fsPath : undefined;
}

function dirArgs() {
  const dir = workspaceDir();
  return dir ? ['--dir', dir] : ['--menu'];
}

function run(args, timeout = 180000) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, DSH_DESKTOP_CLIENT: 'vscode' };
    execFile(launcher(), args, { env, timeout }, (error, stdout, stderr) => {
      if (error) {
        error.output = (stderr || stdout || error.message).trim();
        reject(error);
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

function showError(error) {
  const message = error.code === 'ENOENT'
    ? t('Launcher not found at {0}. Run install.sh from deepseek-harness-desktop.', launcher())
    : error.output || String(error);
  vscode.window.showErrorMessage(`DeepSeek Harness: ${message}`);
}

async function openFile(path) {
  const document = await vscode.workspace.openTextDocument(vscode.Uri.file(path));
  await vscode.window.showTextDocument(document);
}

function activate(context) {
  const output = vscode.window.createOutputChannel('DeepSeek Harness');
  const chat = new ChatViewProvider(context, { launcher, workspaceDir, output });
  context.subscriptions.push(
    output,
    vscode.window.registerWebviewViewProvider('deepseekHarness.chat', chat, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );

  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  item.command = 'deepseekHarness.openChat';
  context.subscriptions.push(item);
  let webAppRunning = false;

  function renderStatus() {
    const icon = chat.busy ? '$(loading~spin)' : '$(comment-discussion)';
    item.text = `${icon} DeepSeek${webAppRunning ? ' $(circle-filled)' : ''}`;
    const tooltip = new vscode.MarkdownString(
      t('Click to open the DeepSeek Harness chat')
      + (webAppRunning ? `\n\n${t('The web app is **running** for this folder.')}` : '')
      + `\n\n[${t('Open web app')}](command:deepseekHarness.start) · `
      + `[${t('Stop web app')}](command:deepseekHarness.stop)`
      + `\n\n[${t('Global config')}](command:deepseekHarness.openGlobalConfig) · `
      + `[${t('Local config')}](command:deepseekHarness.openLocalConfig)`
    );
    tooltip.isTrusted = true;
    item.tooltip = tooltip;
    item.show();
  }
  context.subscriptions.push(chat.onDidChangeBusy.event(renderStatus));

  async function refreshStatus() {
    try {
      await run(['status', ...dirArgs()], 15000);
      webAppRunning = true;
    } catch {
      webAppRunning = false;
    }
    renderStatus();
  }

  async function stop(args, idleMessage) {
    try {
      const output = await run(['stop', ...args]);
      vscode.window.showInformationMessage(output || idleMessage);
    } catch (error) {
      showError(error);
    }
    refreshStatus();
  }

  const commands = {
    'deepseekHarness.openChat': () => vscode.commands.executeCommand('deepseekHarness.chat.focus'),

    'deepseekHarness.newChat': async () => {
      await vscode.commands.executeCommand('deepseekHarness.chat.focus');
      await chat.newChat();
    },

    'deepseekHarness.start': async () => {
      const openIn = vscode.workspace.getConfiguration('deepseekHarness').get('openIn');
      // In window mode the launcher opens the app itself; otherwise the extension opens the URL.
      const openFlag = openIn === 'window' ? '--app' : '--no-open';
      try {
        const url = await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Notification, title: t('Starting DeepSeek Harness…') },
          () => run(['start', ...dirArgs(), openFlag, '--print-url'])
        );
        if (openIn === 'vscode') {
          await vscode.commands.executeCommand('simpleBrowser.show', url);
        } else if (openIn === 'browser') {
          await vscode.env.openExternal(vscode.Uri.parse(url, true));
        }
      } catch (error) {
        showError(error);
      }
      refreshStatus();
    },

    'deepseekHarness.stop': () => stop(dirArgs(), t('DeepSeek Harness was not running for this folder.')),

    'deepseekHarness.stopAll': () => stop(['--all'], t('No DeepSeek Harness instance is running.')),

    'deepseekHarness.openGlobalConfig': async () => {
      try {
        await openFile(await run(['config', 'global']));
      } catch (error) {
        showError(error);
      }
    },

    'deepseekHarness.openLocalConfig': async () => {
      const dir = workspaceDir();
      if (!dir) {
        vscode.window.showWarningMessage(t('DeepSeek Harness: open a folder to use a local configuration.'));
        return;
      }
      try {
        await openFile(await run(['config', 'local', '--dir', dir]));
        vscode.window.showInformationMessage(t('The local configuration applies on the next start (stop, then start).'));
      } catch (error) {
        showError(error);
      }
    },

    'deepseekHarness.showConfig': () => {
      const terminal = vscode.window.createTerminal({ name: 'DeepSeek Harness', cwd: workspaceDir() });
      terminal.show();
      terminal.sendText(`'${launcher().replace(/'/g, `'\\''`)}' config show`);
    },

    'deepseekHarness.menu': async () => {
      const options = [
        { label: `$(comment-discussion) ${t('Open chat')}`, command: 'deepseekHarness.openChat' },
        { label: `$(add) ${t('New chat')}`, command: 'deepseekHarness.newChat' },
        { label: `$(rocket) ${t('Open web app')}`, command: 'deepseekHarness.start' },
        { label: `$(debug-stop) ${t('Stop (this folder)')}`, command: 'deepseekHarness.stop' },
        { label: `$(debug-stop) ${t('Stop all instances')}`, command: 'deepseekHarness.stopAll' },
        { label: `$(globe) ${t('Open global configuration')}`, command: 'deepseekHarness.openGlobalConfig' },
        { label: `$(folder) ${t('Open local (project) configuration')}`, command: 'deepseekHarness.openLocalConfig' },
        { label: `$(list-tree) ${t('Show effective configuration')}`, command: 'deepseekHarness.showConfig' },
      ];
      const choice = await vscode.window.showQuickPick(options, { placeHolder: 'DeepSeek Harness' });
      if (choice) vscode.commands.executeCommand(choice.command);
    },
  };

  for (const [name, handler] of Object.entries(commands)) {
    context.subscriptions.push(vscode.commands.registerCommand(name, handler));
  }

  context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(refreshStatus));
  const interval = setInterval(refreshStatus, STATUS_INTERVAL_MS);
  context.subscriptions.push({ dispose: () => clearInterval(interval) });
  refreshStatus();
}

function deactivate() {}

module.exports = { activate, deactivate };
