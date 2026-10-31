# DeepSeek Harness Desktop — VS Code extension

> Unofficial. Not affiliated with or endorsed by DeepSeek.

Chat with the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`) agent
installed on this computer, right inside VS Code, the way the Claude Code, Codex and OpenCode
extensions work. The chat talks to dsh through the standard
[Agent Client Protocol](https://agentclientprotocol.com) (`dsh --profile acp`), started by the same
launcher as the application menu (`~/.local/bin/deepseek-harness`), so the dsh version, API key and
configuration are shared.

This extension is a thin client: install it with the rest of
[deepseek-harness-desktop](../README.md) via `install.sh`.

## Chat

Open it from the **DeepSeek Harness** icon in the activity bar, the **DeepSeek** status bar item,
or the chat button in the editor title bar. You can drag the view to the secondary sidebar.

- The agent works in the folder of the active file (or the first workspace folder).
- The active file, and the selected lines, are attached to each message as a reference the agent
  can open. Click the 📄 chip to toggle this.
- Model and reasoning effort selectors come from the agent.
- Tool calls show their input, output and file diffs. Permission requests appear inline.
- **Enter** sends, **Shift+Enter** adds a line, **Esc** or **Stop** cancels the turn. Use the **+**
  button for a new chat.

The chat uses dsh's `acp` profile. Settings saved in the web app's Settings screen belong to the
`web` profile and do not apply here, but the global (`~/.dsh/cordis.patch.yml`) and local
(`<project>/.dsh/cordis.patch.yml`) configuration apply to both.

## Commands

`Ctrl+Shift+P` → "DeepSeek Harness":

- Open chat · New chat
- Open web app · Stop (this folder) · Stop all instances
- Open global configuration · Open local (project) configuration · Show effective configuration

## Settings

| Setting | Default | Meaning |
|---|---|---|
| `deepseekHarness.launcherPath` | `~/.local/bin/deepseek-harness` | Launcher to call |
| `deepseekHarness.openIn` | `window` | Where **Open web app** opens: `window` (standalone app), `browser` (tab) or `vscode` (Simple Browser) |

Agent output is logged to the **DeepSeek Harness** output channel. The UI is available in English
and Brazilian Portuguese.
