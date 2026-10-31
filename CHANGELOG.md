# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- New application icon: a friendly whale whose spout is a `>_` prompt.
- The VS Code extension shows the same icon in the Extensions view.

### Removed

- The test suite is no longer part of the repository; CI runs lint and packaging only.

## [0.1.0] — 2026-10-31

First public release. Tested on Arch-based Linux (KDE Plasma 6, Wayland) with Chromium 156 and
VS Code 1.144.

### Added

- `deepseek-harness` launcher: one dsh web instance per folder, `start`/`stop`/`status`,
  global and local `config`, effective `config show`.
- Standalone app window (Chromium `--app`, isolated profile, dedicated `dsh.localhost` host so the
  window gets its own app id on Wayland); closing the window stops the server it started.
- Application menu entry and icon.
- VS Code extension with status bar button, commands and English/pt-BR localization.
- `install.sh` (pinned `@deepseek-ai/dsh` 0.2.1-rc.5) and `uninstall.sh`.
- Offline test suite with stubbed dsh and browser; CI with ShellCheck.

[Unreleased]: https://github.com/YanCarneosso/deepseek-harness-desktop/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/YanCarneosso/deepseek-harness-desktop/releases/tag/v0.1.0
