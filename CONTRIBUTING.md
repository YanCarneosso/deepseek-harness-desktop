# Contributing

Thanks for helping! This project is small on purpose: Bash for the launcher and installer, plain
JavaScript (no build step) for the VS Code extension, and Python's standard library for packaging.

## Development setup

```sh
git clone https://github.com/YanCarneosso/deepseek-harness-desktop.git
cd deepseek-harness-desktop
./install.sh --dev          # links ~/.local/bin/deepseek-harness to your checkout
```

With `--dev`, edits to `bin/` take effect immediately. After changing the extension, rerun
`./install.sh --dev --skip-dsh` and reload VS Code.

## Checks

```sh
make lint   # bash -n, ShellCheck, node --check, JSON and .desktop validation
make vsix   # builds dist/deepseek-harness-desktop.vsix
```

CI runs the same targets on every pull request. Before opening one, try your change by hand: start
from the application menu, open and close the app window, and use the VS Code button.

## Guidelines

- Code, comments and commit messages in English. User-facing extension strings go through
  `vscode.l10n.t` / `package.nls.json`; add the pt-BR translation in
  `vscode-extension/l10n/bundle.l10n.pt-br.json` and `package.nls.pt-br.json`.
- Keep the launcher dependency-free (Bash + coreutils + procps + util-linux).
- Never log or print API keys. The URL token is sensitive too: keep files that hold it mode 600.
- Update `CHANGELOG.md` under *Unreleased*.
- Keep pull requests focused; describe how you tested them.

## Upgrading the pinned dsh version

DeepSeek Harness is in developer preview. When bumping `DSH_VERSION` in `install.sh`, read the
upstream release notes, run the app manually (menu, VS Code button, local patch) and note the
change in `CHANGELOG.md`.
