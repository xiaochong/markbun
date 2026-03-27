#!/usr/bin/env bash
# Create MarkBun wrapper app - AppleScript droplet that launches internal main app
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$PROJECT_ROOT/build"

echo "[create-wrapper] Creating MarkBun wrapper app..."

# Find the main app bundle (in subdirectories, not the wrapper we're about to create)
MAIN_APP=$(find "$BUILD_DIR" -name "*.app" -type d ! -path "*/MarkBun.app/*" 2>/dev/null | head -1)

if [ -z "$MAIN_APP" ]; then
    echo "[create-wrapper] Error: Main app not found in $BUILD_DIR" >&2
    exit 1
fi

MAIN_APP_NAME=$(basename "$MAIN_APP")
echo "[create-wrapper] Found main app: $MAIN_APP_NAME"

# Create temporary directory for all temp files
TMP_DIR=$(mktemp -d /tmp/markbun_wrapper.XXXXXX)
APPLESCRIPT_SRC="$TMP_DIR/wrapper.applescript"
ICON_FILE="$TMP_DIR/icon.icns"

# Create AppleScript - pending file IPC, then launch/activate internal app
# NOTE: heredoc is UNQUOTED so $MAIN_APP_NAME is expanded by bash
cat > "$APPLESCRIPT_SRC" << APPLESCRIPT_EOF
on open theFiles
    set filePath to POSIX path of (item 1 of theFiles)
    -- Write file path to pending file (IPC with main app)
    do shell script "mkdir -p /tmp/markbun && echo " & quoted form of filePath & " > /tmp/markbun/pending.txt"
    -- Launch or activate the internal app
    set appPath to POSIX path of (path to me) & "Contents/MacOS/${MAIN_APP_NAME}"
    do shell script "open " & quoted form of appPath
end open

on run
    -- If launched without files, just open the main app
    set appPath to POSIX path of (path to me) & "Contents/MacOS/${MAIN_APP_NAME}"
    do shell script "open " & quoted form of appPath
end run
APPLESCRIPT_EOF

# Wrapper app name
WRAPPER_APP="$BUILD_DIR/MarkBun.app"
rm -rf "$WRAPPER_APP"

# Create icon
ICONSET_DIR="$PROJECT_ROOT/icon.iconset"
if [ -d "$ICONSET_DIR" ]; then
    echo "[create-wrapper] Creating icon..."
    iconutil -c icns -o "$ICON_FILE" "$ICONSET_DIR" 2>/dev/null || {
        echo "[create-wrapper] Warning: iconutil failed"
    }
fi

# Compile AppleScript to app
osacompile -o "$WRAPPER_APP" "$APPLESCRIPT_SRC" || {
    echo "[create-wrapper] Error: osacompile failed" >&2
    cat "$APPLESCRIPT_SRC"
    exit 1
}

# Move main app into wrapper
mkdir -p "$WRAPPER_APP/Contents/MacOS"
mv "$MAIN_APP" "$WRAPPER_APP/Contents/MacOS/"
echo "[create-wrapper] Moved $MAIN_APP_NAME into wrapper"

# Update Info.plist with file associations and icon reference
cat > "$WRAPPER_APP/Contents/Info.plist" << 'PLIST_EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>droplet</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
    <key>CFBundleIdentifier</key>
    <string>dev.markbun.launcher</string>
    <key>CFBundleName</key>
    <string>MarkBun</string>
    <key>CFBundleDisplayName</key>
    <string>MarkBun</string>
    <key>CFBundleVersion</key>
    <string>0.1.0</string>
    <key>CFBundleShortVersionString</key>
    <string>0.1.0</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>LSUIElement</key>
    <true/>
    <key>CFBundleDocumentTypes</key>
    <array>
        <dict>
            <key>CFBundleTypeName</key>
            <string>Markdown Document</string>
            <key>CFBundleTypeRole</key>
            <string>Editor</string>
            <key>LSHandlerRank</key>
            <string>Alternate</string>
            <key>CFBundleTypeExtensions</key>
            <array>
                <string>md</string>
                <string>markdown</string>
                <string>mdx</string>
            </array>
            <key>LSItemContentTypes</key>
            <array>
                <string>net.daringfireball.markdown</string>
            </array>
        </dict>
    </array>
</dict>
</plist>
PLIST_EOF

# Copy icon
if [ -f "$ICON_FILE" ]; then
    cp "$ICON_FILE" "$WRAPPER_APP/Contents/Resources/AppIcon.icns"
    echo "[create-wrapper] Icon applied"
fi

echo "[create-wrapper] Created: $WRAPPER_APP"

# Clean up temp directory
rm -rf "$TMP_DIR"

echo "[create-wrapper] Done."
