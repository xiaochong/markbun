#!/usr/bin/env bash
# Create MarkBun Opener - AppleScript droplet for file handling
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$PROJECT_ROOT/build"

echo "[create-opener] Creating MarkBun Opener..."

# Create temporary AppleScript source
APPLESCRIPT_SRC=$(mktemp /tmp/opener.XXXXXX.applescript)
cat > "$APPLESCRIPT_SRC" << 'APPLESCRIPT'
on open theFiles
    repeat with aFile in theFiles
        set filePath to POSIX path of aFile
        -- Write file path to pending file (reliable IPC method)
        do shell script "mkdir -p ~/Library/Application\\ Support/dev.markbun.app && echo " & quoted form of filePath & " > ~/Library/Application\\ Support/dev.markbun.app/pending-open.txt"
        -- Open the main app
        do shell script "open -a 'MarkBun-canary'"
    end repeat
end open

on run
    -- If launched without files, just open the main app
    do shell script "open -a 'MarkBun-canary'"
end run
APPLESCRIPT

# Compile to app
OPENER_APP="$BUILD_DIR/MarkBun Opener.app"
rm -rf "$OPENER_APP"
osacompile -o "$OPENER_APP" "$APPLESCRIPT_SRC" 2>/dev/null || {
    echo "[create-opener] Error: osacompile failed" >&2
    exit 1
}
rm "$APPLESCRIPT_SRC"

# Update Info.plist with file associations
cat > "$OPENER_APP/Contents/Info.plist" << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>droplet</string>
    <key>CFBundleIdentifier</key>
    <string>dev.markbun.opener</string>
    <key>CFBundleName</key>
    <string>MarkBun</string>
    <key>CFBundleDisplayName</key>
    <string>MarkBun</string>
    <key>CFBundleVersion</key>
    <string>1.0.0</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
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
    <key>LSUIElement</key>
    <true/>
</dict>
</plist>
PLIST

echo "[create-opener] Created: $OPENER_APP"
echo "[create-opener] Done."
