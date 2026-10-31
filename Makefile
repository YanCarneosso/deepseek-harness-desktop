SHELL_SCRIPTS := bin/deepseek-harness bin/dsh install.sh uninstall.sh tests/run.sh tests/fakes/dsh tests/fakes/browser

.PHONY: check lint test vsix clean

check: lint test

lint:
	bash -n $(SHELL_SCRIPTS)
	shellcheck -S warning $(SHELL_SCRIPTS)
	node --check vscode-extension/extension.js
	for f in vscode-extension/*.json vscode-extension/l10n/*.json; do python3 -m json.tool "$$f" > /dev/null || exit 1; done
	sed -e 's|@BINDIR@|/usr/local/bin|g' -e 's|@APP_HOST@|dsh.localhost|g' \
		share/deepseek-harness-desktop.desktop.in > /tmp/deepseek-harness-desktop.desktop
	desktop-file-validate /tmp/deepseek-harness-desktop.desktop

test:
	tests/run.sh

vsix:
	mkdir -p dist
	python3 -I vscode-extension/scripts/pack_vsix.py dist/deepseek-harness-desktop.vsix

clean:
	rm -rf dist
