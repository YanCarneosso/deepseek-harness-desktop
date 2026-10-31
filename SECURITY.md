# Security policy

## Reporting a vulnerability

Please **do not open a public issue**. Use GitHub's
[private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
on this repository ("Security" tab → "Report a vulnerability"). You should get a reply within
a week.

Vulnerabilities in DeepSeek Harness itself should be reported to the
[upstream project](https://github.com/deepseek-ai/deepseek-harness).

## Security model

- dsh's web server listens on loopback only. This project adds a single extra trusted host,
  `dsh.localhost`, which also resolves to loopback.
- Each dsh process prints a URL carrying a per-process access token. The launcher stores it in
  `~/.local/state/deepseek-harness-desktop/<id>/url` with mode 600 (directory mode 700) and passes it
  only to the browser it opens. The token changes every time the server restarts.
- API keys are never written by this project. When `DSH_DESKTOP_KEY_COMMAND` is set, the key is read
  at start time and passed to dsh through its environment only.
- App windows use a separate browser profile per workspace, isolated from your everyday browser.

## Supported versions

Only the latest release receives fixes.
