// Minimal Agent Client Protocol (ACP v1) client: newline-delimited JSON-RPC 2.0 over a child
// process's stdio. No dependencies, so the extension needs no build step.
const { spawn } = require('child_process');
const { EventEmitter } = require('events');

const PROTOCOL_VERSION = 1;
const CLOSE_GRACE_MS = 3000;

class AcpError extends Error {
  constructor(error) {
    super(error && error.message ? error.message : String(error));
    this.code = error && error.code;
    this.data = error && error.data;
  }
}

// Events: 'update' (session/update params), 'permission' ({ params, respond(outcome) }),
// 'stderr' (text), 'exit' ({ code, signal }).
class AcpClient extends EventEmitter {
  constructor(command, args, options) {
    super();
    this.command = command;
    this.args = args;
    this.options = options;
    this.nextId = 1;
    this.pending = new Map();
    this.buffer = '';
    this.child = undefined;
    this.capabilities = undefined;
  }

  get running() {
    return Boolean(this.child) && this.child.exitCode === null && this.child.signalCode === null;
  }

  async start(clientInfo) {
    this.child = spawn(this.command, this.args, { ...this.options, stdio: ['pipe', 'pipe', 'pipe'] });
    this.child.stdout.setEncoding('utf8');
    this.child.stderr.setEncoding('utf8');
    this.child.stdout.on('data', (chunk) => this.onData(chunk));
    this.child.stderr.on('data', (text) => this.emit('stderr', text));
    this.child.stdin.on('error', () => {});
    const exited = new Promise((resolve) => {
      this.child.on('error', (error) => resolve({ error }));
      this.child.on('exit', (code, signal) => resolve({ code, signal }));
    });
    exited.then((info) => {
      const error = new AcpError({ message: info.error ? info.error.message : `agent exited (${info.signal || info.code})` });
      for (const { reject } of this.pending.values()) reject(error);
      this.pending.clear();
      this.emit('exit', info);
    });

    const result = await this.request('initialize', {
      protocolVersion: PROTOCOL_VERSION,
      clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
      clientInfo,
    });
    this.capabilities = result.agentCapabilities || {};
    return result;
  }

  request(method, params) {
    if (!this.running) return Promise.reject(new AcpError({ message: 'agent is not running' }));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.write({ jsonrpc: '2.0', id, method, params });
    });
  }

  notify(method, params) {
    if (this.running) this.write({ jsonrpc: '2.0', method, params });
  }

  write(message) {
    this.child.stdin.write(JSON.stringify(message) + '\n');
  }

  onData(chunk) {
    this.buffer += chunk;
    let newline;
    while ((newline = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, newline).trim();
      this.buffer = this.buffer.slice(newline + 1);
      if (!line) continue;
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        this.emit('stderr', `non-protocol output: ${line.slice(0, 200)}\n`);
        continue;
      }
      this.dispatch(message);
    }
  }

  dispatch(message) {
    if (message.method === undefined) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new AcpError(message.error));
      else pending.resolve(message.result || {});
      return;
    }
    if (message.method === 'session/update') {
      this.emit('update', message.params);
      return;
    }
    if (message.id === undefined) return;
    if (message.method === 'session/request_permission') {
      let answered = false;
      const respond = (outcome) => {
        if (answered) return;
        answered = true;
        this.write({ jsonrpc: '2.0', id: message.id, result: { outcome } });
      };
      if (this.listenerCount('permission') === 0) respond({ outcome: 'cancelled' });
      else this.emit('permission', { params: message.params, respond });
      return;
    }
    // We advertise no filesystem or terminal capabilities, so nothing else should be asked of us.
    this.write({ jsonrpc: '2.0', id: message.id, error: { code: -32601, message: `Method not found: ${message.method}` } });
  }

  // Closes stdin (dsh treats EOF as a graceful shutdown), then kills the process if it lingers.
  dispose() {
    if (!this.child) return;
    const child = this.child;
    this.removeAllListeners('permission');
    try {
      child.stdin.end();
    } catch {
      // already closed
    }
    const timer = setTimeout(() => child.kill('SIGTERM'), CLOSE_GRACE_MS);
    child.once('exit', () => clearTimeout(timer));
  }
}

module.exports = { AcpClient, AcpError };
