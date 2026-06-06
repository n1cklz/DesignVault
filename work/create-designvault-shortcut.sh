#!/bin/zsh
set -euo pipefail

PROJECT_DIR="/Users/nick/Documents/DesignVault/test"
APP_DIR="$PROJECT_DIR/outputs/DesignVault.app"
CONTENTS_DIR="$APP_DIR/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
RESOURCES_DIR="$CONTENTS_DIR/Resources"
ICONSET_DIR="$PROJECT_DIR/work/DesignVault.iconset"
ICON_PNG_DIR="$PROJECT_DIR/work/icon-preview"
ICON_PNG="$ICON_PNG_DIR/designvault-icon.png"

rm -rf "$APP_DIR" "$ICONSET_DIR" "$ICON_PNG_DIR"
mkdir -p "$MACOS_DIR" "$RESOURCES_DIR" "$ICONSET_DIR" "$ICON_PNG_DIR"

node "$PROJECT_DIR/work/generate-designvault-icon.mjs" "$ICON_PNG"

sips -z 16 16 "$ICON_PNG" --out "$ICONSET_DIR/icon_16x16.png" >/dev/null
sips -z 32 32 "$ICON_PNG" --out "$ICONSET_DIR/icon_16x16@2x.png" >/dev/null
sips -z 32 32 "$ICON_PNG" --out "$ICONSET_DIR/icon_32x32.png" >/dev/null
sips -z 64 64 "$ICON_PNG" --out "$ICONSET_DIR/icon_32x32@2x.png" >/dev/null
sips -z 128 128 "$ICON_PNG" --out "$ICONSET_DIR/icon_128x128.png" >/dev/null
sips -z 256 256 "$ICON_PNG" --out "$ICONSET_DIR/icon_128x128@2x.png" >/dev/null
sips -z 256 256 "$ICON_PNG" --out "$ICONSET_DIR/icon_256x256.png" >/dev/null
sips -z 512 512 "$ICON_PNG" --out "$ICONSET_DIR/icon_256x256@2x.png" >/dev/null
sips -z 512 512 "$ICON_PNG" --out "$ICONSET_DIR/icon_512x512.png" >/dev/null
sips -z 1024 1024 "$ICON_PNG" --out "$ICONSET_DIR/icon_512x512@2x.png" >/dev/null
iconutil -c icns "$ICONSET_DIR" -o "$RESOURCES_DIR/DesignVault.icns"

cat > "$CONTENTS_DIR/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>DesignVault</string>
  <key>CFBundleIconFile</key>
  <string>DesignVault</string>
  <key>CFBundleIdentifier</key>
  <string>local.designvault.launcher</string>
  <key>CFBundleName</key>
  <string>DesignVault</string>
  <key>CFBundleDisplayName</key>
  <string>DesignVault</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>0.1.0</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>LSMinimumSystemVersion</key>
  <string>10.15</string>
</dict>
</plist>
PLIST

cat > "$MACOS_DIR/DesignVault" <<'LAUNCHER'
#!/bin/zsh
PROJECT_DIR="/Users/nick/Documents/DesignVault/test"
LOG_FILE="$PROJECT_DIR/work/designvault-launch.log"
DEBUG_FILE="$PROJECT_DIR/work/designvault-launch-debug.log"
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

if [ -x "/opt/homebrew/bin/npm" ]; then
  NPM_CMD="/opt/homebrew/bin/npm"
else
  NPM_CMD="$(command -v npm 2>/dev/null || true)"
fi

cd "$PROJECT_DIR" || exit 1

{
  echo "----- DesignVault launch $(date) -----"
  echo "PWD=$PWD"
  echo "SHELL=$SHELL"
  echo "PATH=$PATH"
  echo "NPM_CMD=$NPM_CMD"
  if [ ! -d "$PROJECT_DIR/node_modules" ]; then
    osascript -e 'display dialog "DesignVault dependencies are missing. Open the project in Codex and run npm install first." buttons {"OK"} default button "OK" with icon caution'
    exit 1
  fi
  if [ -z "$NPM_CMD" ] || [ ! -x "$NPM_CMD" ]; then
    osascript -e 'display dialog "DesignVault requires npm but could not find it. Install Node/npm or run the app from terminal." buttons {"OK"} default button "OK" with icon caution'
    exit 1
  fi
  "$NPM_CMD" run desktop
} >> "$LOG_FILE" 2>&1
LAUNCHER

chmod +x "$MACOS_DIR/DesignVault"
touch "$APP_DIR"

echo "$APP_DIR"
