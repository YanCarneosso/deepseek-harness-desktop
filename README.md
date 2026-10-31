# deepseek-harness-desktop

English | [Português (Brasil)](README.pt-BR.md)

Desktop integration for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`)
on Linux: open it from your application menu as a standalone app window, chat with it inside
VS Code, and manage its global and per-project configuration.

> **Unofficial project.** Not affiliated with, endorsed by or supported by DeepSeek.
> DeepSeek Harness itself is in developer preview; expect breaking changes upstream.

## Features

- **Standalone app window**: dsh's web UI opens in a Chromium `--app` window with its own isolated
  profile and its own taskbar icon (also on Wayland). Closing the window stops the server it started.
- **Application menu entry** with *Stop* and *Edit global configuration* actions.
- **VS Code chat**: talk to the dsh agent in a sidebar chat, like the Claude Code, Codex and
  OpenCode extensions, over the standard Agent Client Protocol. Tool calls, diffs, permission
  prompts, model and reasoning effort selection. English and Brazilian Portuguese UI.
- **One instance per folder**, each on its own port (from 3080), shared by the menu, VS Code and the
  terminal.
- **Global and local configuration**: `~/.dsh/cordis.patch.yml` for every project and
  `<project>/.dsh/cordis.patch.yml` for one project, applied in dsh's own layer order.
- **Pinned dsh version**, installed per user without root.

## Requirements

- Linux with a freedesktop application menu (KDE Plasma, GNOME, …)
- Node.js and npm (a version supported by `@deepseek-ai/dsh`)
- A Chromium-based browser for app mode (Chromium, Google Chrome, Brave, Vivaldi or Edge);
  without one, use tab mode
- Optional: VS Code (`code` on `PATH`) for the extension
- A DeepSeek API key

## Install

```sh
git clone https://github.com/YanCarneosso/deepseek-harness-desktop.git
cd deepseek-harness-desktop
./install.sh
```

The installer puts the pinned `@deepseek-ai/dsh` in `~/.local/lib/dsh`, the `deepseek-harness`
launcher and a `dsh` wrapper in `~/.local/bin`, the menu entry and icon in `~/.local/share`, and
installs the VS Code extension. Options: `--dsh-version VERSION`, `--skip-dsh`, `--skip-vscode`,
`--dev` (link the launcher to the checkout instead of copying it).

Then give dsh your API key in one of these ways:

- `DEEPSEEK_API_KEY=...` in `~/.dsh/.env`
- Settings → Models inside the app
- `DSH_DESKTOP_KEY_COMMAND` in the launcher preferences, for a command that prints the key
  (for example from a password manager)

## Usage

- **Menu**: open *DeepSeek Harness*.
- **VS Code**: reload the window, then open the **DeepSeek Harness** chat from the activity bar or
  click **DeepSeek** in the status bar. See the [extension README](vscode-extension/README.md).
- **Terminal**:

```sh
deepseek-harness start                 # current folder, app window
deepseek-harness start --dir ~/proj --tab
deepseek-harness status --all
deepseek-harness stop --all
deepseek-harness config global --edit  # ~/.dsh/cordis.patch.yml
deepseek-harness config local --edit   # ./.dsh/cordis.patch.yml
deepseek-harness config show           # effective configuration
```

See [docs/configuration.md](docs/configuration.md) for the configuration layers and launcher
preferences, [docs/architecture.md](docs/architecture.md) for how it works, and
[docs/troubleshooting.md](docs/troubleshooting.md) when something goes wrong.

## Uninstall

```sh
./uninstall.sh               # keeps ~/.dsh, the dsh CLI and your preferences
./uninstall.sh --remove-dsh --purge
```

`~/.dsh` (your sessions, profiles and credentials) is never removed.

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md). Security reports:
[SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE). DeepSeek Harness is a separate project under its own license.
