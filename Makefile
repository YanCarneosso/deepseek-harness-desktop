SHELL_SCRIPTS := bin/deepseek-harness bin/dsh install.sh uninstall.sh

.PHONY: check lint test vsix clean

check: lint test

lint:
	for f in $(SHELL_SCRIPTS); do bash -n "$$f" || exit 1; done
	shellcheck -S warning $(SHELL_SCRIPTS)
	node --check vscode-extension/extension.js
	for f in vscode-extension/*.json vscode-extension/l10n/*.json; do python3 -m json.tool "$$f" > /dev/null || exit 1; done
	sed -e 's|@BINDIR@|/usr/local/bin|g' -e 's|@APP_HOST@|dsh.localhost|g' \
		share/deepseek-harness-desktop.desktop.in > /tmp/deepseek-harness-desktop.desktop
	desktop-file-validate /tmp/deepseek-harness-desktop.desktop

# The test suite is kept out of the repository; this runs a local copy when one exists.
test:
	@if [ -x tests/run.sh ]; then tests/run.sh; else echo "no local tests/run.sh; skipped"; fi

vsix:
	mkdir -p dist
	python3 -I vscode-extension/scripts/pack_vsix.py dist/deepseek-harness-desktop.vsix

clean:
	rm -rf dist
