# Architecture

```
 application menu ──┐
 VS Code extension ─┼──► deepseek-harness (launcher) ──► dsh --profile web ──► http://127.0.0.1:PORT
 terminal ──────────┘            │                                                   ▲
                                 └──► Chromium --app (isolated profile) ─────────────┘
                                       http://dsh.localhost:PORT

 VS Code chat view ◄── ACP (JSON-RPC over stdio) ──► deepseek-harness acp ──► dsh --profile acp
```

Everything goes through one Bash launcher, `bin/deepseek-harness`. The menu entry and the VS Code
extension are thin clients that call it, so they always share the same dsh installation, instances
and configuration.

## Instances

- One dsh web server per workspace folder. The folder's real path is hashed into a state directory,
  `~/.local/state/deepseek-harness-desktop/<id>/`, which holds:
  - `dir`: the workspace path
  - `pid`: the dsh process id
  - `url`: the authenticated URL (mode 600)
  - `log`: dsh output
  - `window/` and `window.log`: the app window's browser profile and log
- `start` reuses a running instance; otherwise it picks the first free port from
  `DSH_DESKTOP_FIRST_PORT`, starts `dsh --profile web --no-open --port N --trusted-host <app host>`
  (plus `--patch <project>/.dsh/cordis.patch.yml` when present) in its own session, and waits for
  the `dsh web: <url>` line.
- A process counts as running when its pid is alive and its command line still mentions dsh, which
  guards against pid reuse.
- `stop` removes `pid`/`url` before signalling the process, so a `start` racing with a `stop` never
  loses its fresh state files.

## App window

- The launcher re-executes itself detached (`setsid -f deepseek-harness _window …`) with no
  inherited stdout/stderr, so callers that read its output (VS Code, pipes) return immediately.
- The window is `chromium --app=<url>` with `--user-data-dir=<state>/window`: a separate browser
  process per workspace, isolated from the user's everyday browser.
- **Wayland naming.** Chromium ignores `--class` on Wayland and derives the window's app id from the
  URL host: `chrome-<host>__-Default`. Opening `127.0.0.1` would group the window with any other
  local web app, so the launcher opens `dsh.localhost` instead. Chromium resolves `*.localhost` to
  loopback, dsh accepts it through `--trusted-host`, and the menu entry's `StartupWMClass` is
  `chrome-dsh.localhost__-Default`, so the taskbar shows the app's own icon.
- When the browser exits (or, if the profile was already open, when the owning browser process
  exits), the watcher stops the server if this launch started it. A server that was already running,
  for example one started by VS Code, is left alone.

## Why not the official desktop app?

DeepSeek Harness has an Electron desktop app in its source tree, but its GitHub releases ship no
Linux binaries. Building it from source in developer preview would be fragile. A Chromium app window
over the officially supported web profile gives a comparable experience with nothing to compile.

## Installation layout

| Path | Content |
|---|---|
| `~/.local/lib/dsh` | `@deepseek-ai/dsh` at the pinned version (npm prefix) |
| `~/.local/share/deepseek-harness-desktop/bin` | launcher and dsh wrapper (copied; `--dev` links to the checkout instead) |
| `~/.local/bin/{deepseek-harness,dsh}` | symlinks to the above |
| `~/.local/share/applications/deepseek-harness-desktop.desktop` | menu entry, generated from `share/*.desktop.in` |
| `~/.local/share/icons/hicolor/scalable/apps/deepseek-harness-desktop.svg` | icon |
| `~/.config/deepseek-harness-desktop/launcher.env` | launcher preferences |
| `~/.local/state/deepseek-harness-desktop/` | per-instance state |
| `~/.dsh/` | dsh's own data: profiles, sessions, credentials (managed by dsh) |

## VS Code extension

`vscode-extension/` is plain JavaScript with no dependencies or build step. `scripts/pack_vsix.py`
assembles the `.vsix` (manifest, content types, `l10n/` and `media/`, license) with the Python
standard library, so neither `vsce` nor npm packages are needed. Runtime strings use
`vscode.l10n.t`; contributed titles use `package.nls*.json`.

### Chat over ACP

The chat view is a client of the [Agent Client Protocol](https://agentclientprotocol.com), the same
standard editors use to embed coding agents. dsh implements it in its `acp` profile.

| File | Role |
|---|---|
| `acp.js` | Minimal ACP v1 client: newline-delimited JSON-RPC 2.0 over a child process's stdio, request/response matching, `session/update` notifications, `session/request_permission` requests |
| `chat.js` | Webview view provider: one agent process per workspace folder (`deepseek-harness acp --dir DIR`), one ACP session per chat, permissions, active-file context, model/effort options |
| `media/chat.js`, `media/chat.css` | Webview UI. Agent and tool text is inserted with DOM APIs and `textContent` only, under a strict Content Security Policy with a per-load script nonce |

Flow:

1. When the view opens, the extension starts `deepseek-harness acp --dir <folder>`, which applies
   the API key and local patch and `exec`s `dsh --profile acp` in that folder.
2. `initialize` declares no client filesystem or terminal capability: dsh uses its own local tools.
3. `session/new` returns the session id and its `model` and `reasoning_effort` options, which the
   UI shows as selectors and changes through `session/set_config_option`.
4. `session/prompt` carries the text plus, when attached, a `resource_link` to the active file
   (with a `#Lstart-end` fragment for a selection).
5. `session/update` notifications render as they arrive: messages, thoughts, tool calls and their
   updates (output and diffs) and `usage_update`.
6. **Stop** sends `session/cancel`; **New chat** sends `session/close` and opens a new session.
   Closing VS Code ends stdin, which dsh treats as a graceful shutdown.

The `acp` profile is separate from the `web` profile: settings saved in the web app's Settings
screen do not apply to the chat, while `~/.dsh/cordis.patch.yml` and the project's
`.dsh/cordis.patch.yml` apply to both. dsh's ACP surface is deliberately standard. It has no
transcript replay, so a reopened VS Code starts a new chat, and it has no plan or todo cards.
