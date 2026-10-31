# DeepSeek Harness Desktop — VS Code extension

> Unofficial. Not affiliated with or endorsed by DeepSeek.

Adds a **🚀 DeepSeek** button to the status bar that starts the
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`) installed on this computer
for the current workspace folder. It calls the same launcher as the application menu
(`~/.local/bin/deepseek-harness`), so the dsh version, API key and configuration are shared.

This extension is a thin client: install it with the rest of
[deepseek-harness-desktop](../README.md) via `install.sh`.

## Commands

`Ctrl+Shift+P` → "DeepSeek Harness":

- Start / open · Stop (this folder) · Stop all instances
- Open global configuration (`~/.dsh/cordis.patch.yml`)
- Open local (project) configuration (`<project>/.dsh/cordis.patch.yml`)
- Show effective configuration

## Settings

| Setting | Default | Meaning |
|---|---|---|
| `deepseekHarness.launcherPath` | `~/.local/bin/deepseek-harness` | Launcher to call |
| `deepseekHarness.openIn` | `window` | `window` (standalone app), `browser` (tab) or `vscode` (Simple Browser) |

The UI is available in English and Brazilian Portuguese.
