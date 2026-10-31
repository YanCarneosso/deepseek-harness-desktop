"""Packs the VS Code extension into a .vsix without needing vsce.

Usage: python3 -I scripts/pack_vsix.py OUTPUT.vsix
"""
import json
import sys
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

EXTENSION = Path(__file__).resolve().parent.parent
REPO = EXTENSION.parent
FILES = ["package.json", "package.nls.json", "package.nls.pt-br.json", "extension.js",
         "README.md", "CHANGELOG.md", "icon.png"]

CONTENT_TYPES = """<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension=".json" ContentType="application/json"/>
  <Default Extension=".js" ContentType="application/javascript"/>
  <Default Extension=".md" ContentType="text/markdown"/>
  <Default Extension=".png" ContentType="image/png"/>
  <Default Extension=".txt" ContentType="text/plain"/>
  <Default Extension=".vsixmanifest" ContentType="text/xml"/>
</Types>
"""


def manifest(pkg, nls):
    def text(value):
        # Resolve "%key%" placeholders against package.nls.json.
        if value.startswith("%") and value.endswith("%"):
            value = nls.get(value[1:-1], value)
        return escape(value)

    return f"""<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011" xmlns:d="http://schemas.microsoft.com/developer/vsx-schema-design/2011">
  <Metadata>
    <Identity Language="en-US" Id="{escape(pkg['name'])}" Version="{escape(pkg['version'])}" Publisher="{escape(pkg['publisher'])}"/>
    <DisplayName>{text(pkg['displayName'])}</DisplayName>
    <Description xml:space="preserve">{text(pkg['description'])}</Description>
    <Tags></Tags>
    <Categories>{escape(','.join(pkg.get('categories', [])))}</Categories>
    <GalleryFlags>Public</GalleryFlags>
    <Properties>
      <Property Id="Microsoft.VisualStudio.Code.Engine" Value="{escape(pkg['engines']['vscode'])}"/>
      <Property Id="Microsoft.VisualStudio.Code.ExtensionDependencies" Value=""/>
      <Property Id="Microsoft.VisualStudio.Code.ExtensionPack" Value=""/>
      <Property Id="Microsoft.VisualStudio.Code.ExtensionKind" Value="workspace"/>
    </Properties>
    <License>extension/LICENSE.txt</License>
    <Icon>extension/{escape(pkg['icon'])}</Icon>
  </Metadata>
  <Installation>
    <InstallationTarget Id="Microsoft.VisualStudio.Code"/>
  </Installation>
  <Dependencies/>
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true"/>
    <Asset Type="Microsoft.VisualStudio.Services.Content.Details" Path="extension/README.md" Addressable="true"/>
    <Asset Type="Microsoft.VisualStudio.Services.Content.Changelog" Path="extension/CHANGELOG.md" Addressable="true"/>
    <Asset Type="Microsoft.VisualStudio.Services.Content.License" Path="extension/LICENSE.txt" Addressable="true"/>
    <Asset Type="Microsoft.VisualStudio.Services.Icons.Default" Path="extension/{escape(pkg['icon'])}" Addressable="true"/>
  </Assets>
</PackageManifest>
"""


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    pkg = json.loads((EXTENSION / "package.json").read_text(encoding="utf-8"))
    nls = json.loads((EXTENSION / "package.nls.json").read_text(encoding="utf-8"))
    with zipfile.ZipFile(sys.argv[1], "w", zipfile.ZIP_DEFLATED) as vsix:
        vsix.writestr("[Content_Types].xml", CONTENT_TYPES)
        vsix.writestr("extension.vsixmanifest", manifest(pkg, nls))
        for name in FILES:
            vsix.write(EXTENSION / name, f"extension/{name}")
        for bundle in sorted((EXTENSION / "l10n").glob("*.json")):
            vsix.write(bundle, f"extension/l10n/{bundle.name}")
        vsix.write(REPO / "LICENSE", "extension/LICENSE.txt")


if __name__ == "__main__":
    main()
