// Chat webview front end. Renders ACP session updates relayed by chat.js and sends user actions
// back to the extension host. Everything is built with DOM APIs and textContent (no innerHTML of
// agent output), so model or tool text can never inject markup into the view.
(function () {
  const vscode = acquireVsCodeApi();
  const toolbar = document.getElementById('toolbar');
  const transcript = document.getElementById('transcript');
  const composer = document.getElementById('composer');

  let strings = {};
  let state = { busy: false, starting: false, cwd: '', configOptions: [] };
  let context = { file: undefined, attach: true };
  let usage;
  const messages = new Map(); // messageId -> element holding the text
  const tools = new Map(); // toolCallId -> card parts
  const permissions = new Map(); // requestId -> card

  // ---------------------------------------------------------------- helpers
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function format(template, ...values) {
    return template.replace(/\{(\d+)\}/g, (_, i) => values[Number(i)]);
  }

  function compact(n) {
    if (n >= 1e6) return `${(n / 1e6).toFixed(n % 1e6 ? 1 : 0)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
    return String(n);
  }

  function scrollToEnd() {
    transcript.scrollTop = transcript.scrollHeight;
  }

  function add(node) {
    transcript.querySelector('.empty')?.remove();
    transcript.appendChild(node);
    scrollToEnd();
    return node;
  }

  // Small, safe Markdown subset: fenced code, inline code, bold, headings, bullet lists, paragraphs.
  function renderMarkdown(container, text) {
    container.textContent = '';
    const parts = text.split(/```/);
    parts.forEach((part, index) => {
      if (index % 2 === 1) {
        const newline = part.indexOf('\n');
        const code = newline >= 0 ? part.slice(newline + 1) : part;
        const pre = el('pre');
        pre.appendChild(el('code', '', code.replace(/\n$/, '')));
        container.appendChild(pre);
        return;
      }
      let list;
      for (const line of part.split('\n')) {
        const bullet = /^\s*(?:[-*]|\d+\.)\s+(.*)$/.exec(line);
        if (bullet) {
          if (!list) list = container.appendChild(el('ul'));
          list.appendChild(inline(el('li'), bullet[1]));
          continue;
        }
        list = undefined;
        if (!line.trim()) continue;
        const heading = /^(#{1,4})\s+(.*)$/.exec(line);
        container.appendChild(inline(el(heading ? 'h4' : 'p'), heading ? heading[2] : line));
      }
    });
  }

  function inline(node, text) {
    for (const token of text.split(/(`[^`]+`|\*\*[^*]+\*\*)/)) {
      if (!token) continue;
      if (token.startsWith('`') && token.endsWith('`')) node.appendChild(el('code', '', token.slice(1, -1)));
      else if (token.startsWith('**') && token.endsWith('**')) node.appendChild(el('strong', '', token.slice(2, -2)));
      else node.appendChild(document.createTextNode(token));
    }
    return node;
  }

  function contentText(content) {
    if (!content) return '';
    if (content.type === 'text') return content.text;
    if (content.type === 'resource_link') return `[${content.name}] ${content.uri}`;
    return `[${content.type}]`;
  }

  // ---------------------------------------------------------------- toolbar
  function renderToolbar() {
    toolbar.textContent = '';
    for (const option of state.configOptions || []) {
      if (option.type !== 'select') continue;
      const select = el('select');
      select.title = option.name;
      select.disabled = state.busy;
      const addOptions = (parent, list) => {
        for (const item of list) {
          if (Array.isArray(item.options)) {
            const group = el('optgroup');
            group.label = item.name;
            addOptions(group, item.options);
            parent.appendChild(group);
          } else {
            const opt = el('option', '', item.name);
            opt.value = item.value;
            if (item.description) opt.title = item.description;
            opt.selected = item.value === option.currentValue;
            parent.appendChild(opt);
          }
        }
      };
      addOptions(select, option.options || []);
      select.addEventListener('change', () => vscode.postMessage({ type: 'setConfig', configId: option.id, value: select.value }));
      toolbar.appendChild(select);
    }
    toolbar.hidden = !toolbar.children.length;
  }

  // --------------------------------------------------------------- composer
  const input = el('textarea');
  input.rows = 3;
  const contextChip = el('button', 'chip');
  const usageLabel = el('span', 'usage');
  const status = el('span', 'status');
  const action = el('button', 'primary');

  function renderComposer() {
    composer.textContent = '';
    input.placeholder = strings.placeholder || '';
    composer.appendChild(input);
    const row = composer.appendChild(el('div', 'row'));
    row.append(contextChip, status, usageLabel, action);
    updateComposer();
  }

  function updateComposer() {
    action.textContent = state.busy ? strings.stop : strings.send;
    action.classList.toggle('danger', state.busy);
    status.textContent = state.starting ? strings.starting : state.busy ? strings.working : '';
    status.classList.toggle('pulse', state.busy || state.starting);
    if (context.file) {
      contextChip.hidden = false;
      contextChip.textContent = `📄 ${context.file.name}`;
      contextChip.classList.toggle('off', !context.attach);
      contextChip.title = context.attach ? strings.context : strings.contextOff;
    } else {
      contextChip.hidden = true;
    }
    usageLabel.textContent = usage ? format(strings.contextUsage || '{0}/{1}', compact(usage.used), compact(usage.size)) : '';
  }

  function submit() {
    if (state.busy) {
      vscode.postMessage({ type: 'cancel' });
      return;
    }
    const text = input.value.trim();
    if (!text) return;
    const bubble = add(el('div', 'msg user'));
    bubble.appendChild(el('div', 'body', text));
    if (context.attach && context.file) bubble.appendChild(el('div', 'attachment', `📄 ${context.file.name}`));
    input.value = '';
    vscode.postMessage({ type: 'send', text });
  }

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      submit();
    } else if (event.key === 'Escape' && state.busy) {
      vscode.postMessage({ type: 'cancel' });
    }
  });
  action.addEventListener('click', submit);
  contextChip.addEventListener('click', () => vscode.postMessage({ type: 'toggleContext' }));

  // ------------------------------------------------------------- transcript
  function renderEmpty() {
    if (transcript.children.length) return;
    const empty = transcript.appendChild(el('div', 'empty'));
    empty.appendChild(el('p', '', strings.empty));
    empty.appendChild(el('code', '', state.cwd));
  }

  function agentMessage(update) {
    const id = update.messageId || 'last-agent';
    let body = messages.get(id);
    if (!body || !body.isConnected) {
      const bubble = add(el('div', 'msg agent'));
      body = bubble.appendChild(el('div', 'body'));
      body.dataset.raw = '';
      messages.set(id, body);
    }
    body.dataset.raw += contentText(update.content);
    renderMarkdown(body, body.dataset.raw);
    scrollToEnd();
  }

  function thought(update) {
    const id = update.messageId && `thought:${update.messageId}`;
    let body = id && messages.get(id);
    if (!body || !body.isConnected) {
      const details = add(el('details', 'thought'));
      details.appendChild(el('summary', '', strings.thinking));
      body = details.appendChild(el('div', 'body'));
      if (id) messages.set(id, body);
    }
    body.textContent += contentText(update.content);
  }

  const KIND_ICONS = { read: '📄', edit: '✎', delete: '🗑', move: '⇄', search: '🔍', execute: '▶', think: '💭', fetch: '🌐' };

  function toolInputSummary(raw) {
    if (!raw || typeof raw !== 'object') return '';
    return raw.command || raw.path || raw.file_path || raw.pattern || raw.url || raw.query || JSON.stringify(raw);
  }

  function toolCall(update) {
    let card = tools.get(update.toolCallId);
    if (!card) {
      const root = add(el('div', 'tool'));
      const head = root.appendChild(el('div', 'head'));
      card = {
        root,
        icon: head.appendChild(el('span', 'kind')),
        title: head.appendChild(el('span', 'title')),
        status: head.appendChild(el('span', 'badge')),
        input: root.appendChild(el('code', 'input')),
        details: root.appendChild(el('details', 'output')),
      };
      card.details.appendChild(el('summary', '', strings.output));
      card.details.hidden = true;
      tools.set(update.toolCallId, card);
    }
    if (update.kind) card.icon.textContent = KIND_ICONS[update.kind] || '⚙';
    if (update.title) card.title.textContent = update.title;
    if (update.status) {
      card.status.textContent = { pending: '…', in_progress: '⏳', completed: '✓', failed: '✗' }[update.status] || update.status;
      card.root.dataset.status = update.status;
    }
    if (update.rawInput) card.input.textContent = toolInputSummary(update.rawInput);
    card.input.hidden = !card.input.textContent;
    if (Array.isArray(update.content) && update.content.length) {
      card.details.hidden = false;
      for (const item of update.content) {
        if (item.type === 'diff') {
          const diff = card.details.appendChild(el('div', 'diff'));
          diff.appendChild(el('div', 'path', item.path));
          const pre = diff.appendChild(el('pre'));
          for (const line of (item.oldText || '').split('\n').filter(Boolean)) pre.appendChild(el('div', 'del', `- ${line}`));
          for (const line of (item.newText || '').split('\n').filter(Boolean)) pre.appendChild(el('div', 'ins', `+ ${line}`));
        } else if (item.type === 'content') {
          const text = contentText(item.content);
          card.details.appendChild(el('pre', '', text.length > 8000 ? `${text.slice(0, 8000)}\n…` : text));
        }
      }
    }
    scrollToEnd();
  }

  function permission(message) {
    const card = add(el('div', 'permission'));
    card.appendChild(el('div', 'title', `🔐 ${strings.permission}: ${message.toolCall?.title || ''}`));
    const summary = toolInputSummary(message.toolCall?.rawInput);
    if (summary) card.appendChild(el('code', 'input', summary));
    const buttons = card.appendChild(el('div', 'buttons'));
    for (const option of message.options || []) {
      const button = buttons.appendChild(el('button', option.kind.startsWith('allow') ? 'primary' : 'secondary', option.name));
      button.addEventListener('click', () => {
        vscode.postMessage({ type: 'permission', requestId: message.requestId, optionId: option.optionId });
        closePermission(message.requestId, option.name);
      });
    }
    permissions.set(message.requestId, card);
  }

  function closePermission(requestId, outcome) {
    const card = permissions.get(requestId);
    if (!card) return;
    permissions.delete(requestId);
    card.querySelector('.buttons')?.replaceWith(el('div', 'answer', outcome));
  }

  function notice(kind, text) {
    add(el('div', `notice ${kind}`, text));
  }

  // ---------------------------------------------------------------- events
  window.addEventListener('message', ({ data }) => {
    switch (data.type) {
      case 'strings':
        strings = data.strings;
        renderToolbar();
        renderComposer();
        renderEmpty();
        break;
      case 'state':
        state = data;
        renderToolbar();
        updateComposer();
        renderEmpty();
        break;
      case 'context':
        context = { file: data.file, attach: data.attach };
        updateComposer();
        break;
      case 'update': {
        const update = data.update;
        switch (update.sessionUpdate) {
          case 'agent_message_chunk':
            agentMessage(update);
            break;
          case 'agent_thought_chunk':
            thought(update);
            break;
          case 'tool_call':
          case 'tool_call_update':
            toolCall(update);
            break;
          case 'usage_update':
            usage = { used: update.used, size: update.size };
            updateComposer();
            break;
        }
        break;
      }
      case 'permission':
        permission(data);
        break;
      case 'permissionClosed':
        closePermission(data.requestId, strings.cancelled);
        break;
      case 'turnEnd':
        if (data.stopReason && data.stopReason !== 'end_turn') notice('info', format(strings.stopped, data.stopReason));
        break;
      case 'notice':
        notice(data.kind, data.text);
        break;
      case 'reset':
        transcript.textContent = '';
        messages.clear();
        tools.clear();
        permissions.clear();
        usage = undefined;
        renderEmpty();
        updateComposer();
        break;
    }
  });

  vscode.postMessage({ type: 'ready' });
  input.focus();
})();
