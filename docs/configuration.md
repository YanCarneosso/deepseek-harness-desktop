# Configuration

There are two kinds of configuration: **dsh's own configuration** (models, tools, plugins), which
this project only helps you create and open, and the **launcher preferences**, which control how
the app is started.

## dsh configuration layers

dsh composes its configuration from YAML patch layers. Later layers win:

| # | File | Scope | How to open |
|---|---|---|---|
| 1 | bundle defaults | dsh itself | — |
| 2 | `~/.dsh/profiles/web/cordis.patch.yml` | what the **Settings** screen saves | the app's Settings |
| 3 | `~/.dsh/cordis.patch.yml` | **global**, every project | `deepseek-harness config global --edit` |
| 4 | `<project>/.dsh/cordis.patch.yml` | **local**, one project | `deepseek-harness config local --edit` |

Layer 4 is not read by dsh on its own: the launcher passes it with `dsh --patch` when the file
exists. If you start dsh by hand, pass it yourself: `dsh web --patch .dsh/cordis.patch.yml`.

The VS Code chat runs dsh's `acp` profile instead of `web`, so its layer 2 is
`~/.dsh/profiles/acp/cordis.patch.yml`, and the web app's Settings screen does not affect it.
Layers 3 and 4 apply to both profiles, which makes them the place for settings you want everywhere.
The `acp` profile starts sessions on `deepseek-v4-flash`. The model and reasoning effort can be
changed per chat from the chat's selectors.

Things to know:

- A field set in layer 3 or 4 can no longer be changed from the Settings screen; dsh refuses the
  write because a higher layer would override it.
- The global layer reloads live; the local layer applies on the next start.
- `deepseek-harness config show [--dir DIR]` prints the composed result (`dsh --dump-config`), which
  is also the easiest way to find entry ids.
- `config global` and `config local` create a commented template containing an empty list (`[]`)
  when the file is missing, and never overwrite an existing file.

Example: use DeepSeek V4 Pro with high reasoning effort in one project only:

```yaml
# <project>/.dsh/cordis.patch.yml
- id: agent-default-model
  name: "@deepseek-ai/dsh-agent-default-model"
  config:
    provider: deepseek-official
    model: deepseek-v4-pro
    reasoningEffort: high
```

dsh also reads these, at both levels:

| Purpose | Global | Local |
|---|---|---|
| Agent instructions | `~/.dsh/AGENTS.md` | `AGENTS.md`, `CLAUDE.md`, `AGENTS.local.md` from the git root down |
| Environment variables | `~/.dsh/.env` | `<project>/.env` |

Never commit API keys: keep them in `~/.dsh/.env`, the Settings screen or `DSH_DESKTOP_KEY_COMMAND`.

## Launcher preferences

`~/.config/deepseek-harness-desktop/launcher.env` is a shell file sourced by the launcher.
`install.sh` creates it from [share/launcher.env.example](../share/launcher.env.example) and never
overwrites it. Precedence: this file > environment variables > built-in defaults.

| Variable | Default | Meaning |
|---|---|---|
| `DSH_DESKTOP_WORKSPACE` | `$HOME` | Folder opened from the application menu |
| `DSH_DESKTOP_FIRST_PORT` | `3080` | First port tried; each running folder takes the next free one |
| `DSH_DESKTOP_START_TIMEOUT` | `120` | Seconds to wait for the web UI to come up |
| `DSH_DESKTOP_APP_MODE` | `1` | `1` app window, `0` browser tab |
| `DSH_DESKTOP_BROWSER` | *(auto)* | Browser for app mode; must be Chromium-based. When set, it is never silently replaced |
| `DSH_DESKTOP_STOP_ON_CLOSE` | `1` | Closing the window stops the server it started |
| `DSH_DESKTOP_APP_HOST` | `dsh.localhost` | Host used in the window URL; names the window on Wayland. Must resolve to loopback. If you change it, rerun `install.sh` so the menu entry matches |
| `DSH_DESKTOP_KEY_COMMAND` | *(empty)* | Command (no shell syntax) that prints the API key, used when `DEEPSEEK_API_KEY` is unset |
| `DSH_DESKTOP_DSH_BIN` | `~/.local/bin/dsh` | dsh executable to run |
| `DSH_TELEMETRY_DISABLED` | `1` (exported) | dsh's own telemetry switch |

Per-call flags override the open mode: `--app`, `--tab`, `--no-open`.

## VS Code extension settings

| Setting | Default | Meaning |
|---|---|---|
| `deepseekHarness.launcherPath` | `~/.local/bin/deepseek-harness` | Launcher to call |
| `deepseekHarness.openIn` | `window` | `window`, `browser` or `vscode` (Simple Browser) |
