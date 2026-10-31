# Troubleshooting

Start with:

```sh
deepseek-harness status --all
cat ~/.local/state/deepseek-harness-desktop/*/log          # dsh output
cat ~/.local/state/deepseek-harness-desktop/*/window.log   # app window
```

## npm warns that install scripts were blocked

Recent npm versions block dependency install scripts unless they are approved. For
`@deepseek-ai/dsh` 0.2.1-rc.5 on Linux x64 this is harmless:

| Package | What the blocked script does | Needed? |
|---|---|---|
| `node-pty` | checks that a prebuilt binary exists (it ships `prebuilds/linux-x64`) | no |
| `koffi` | builds from source only if the bundled prebuilt binary fails to load | no |
| `@deepseek-ai/dsh-subprocess-local` | marks node-pty's macOS `spawn-helper` executable | no (macOS only) |
| `protobufjs`, `@google/genai` | version notice / no-op | no |

Check with `node -e 'require(process.argv[1])' ~/.local/lib/dsh/node_modules/koffi`. If it fails on
your platform, review the scripts and approve them with `npm install-scripts approve <pkg>`.

## The window opens as a normal browser tab, or not at all

App mode needs a Chromium-based browser. Firefox-based browsers (Firefox, Zen, LibreWolf) have no
`--app` mode. Install Chromium, set `DSH_DESKTOP_BROWSER`, or use tab mode
(`DSH_DESKTOP_APP_MODE=0`). If `DSH_DESKTOP_BROWSER` points to something missing, the launcher
reports it instead of falling back to another browser.

## The window has a generic icon or groups with other apps

The menu entry's `StartupWMClass` must match `chrome-<DSH_DESKTOP_APP_HOST>__-Default`. After
changing `DSH_DESKTOP_APP_HOST`, rerun `./install.sh --skip-dsh`.

## "dsh did not come up within 120s"

The first start sets up dsh's web profile and can be slow; raise `DSH_DESKTOP_START_TIMEOUT`.
Otherwise read the instance `log`. Running `dsh --version` checks the installation.

## The model returns authentication errors

dsh found no API key. Set `DEEPSEEK_API_KEY` in `~/.dsh/.env`, save it in Settings → Models, or
configure `DSH_DESKTOP_KEY_COMMAND`. A failing key command prints a warning, and dsh then uses its
stored credential.

## The VS Code button does nothing / "Launcher not found"

Run `./install.sh` (it creates `~/.local/bin/deepseek-harness`) or point
`deepseekHarness.launcherPath` at the launcher, then reload the window.

## The local configuration is ignored

It applies only on the next start and only through the launcher (`--patch`). Stop and start the
folder's instance, then check `deepseek-harness config show --dir <project>`.
