#!/usr/bin/env bash
# Patch Info.plist to add CFBundleDocumentTypes for .md file association
set -euo pipefail

# Dynamically find the canary app's Info.plist (handles platform/arch variants)
PLIST_PATH=$(find build -path "*/canary*/MarkBun*.app/Contents/Info.plist" ! -path "*/Frameworks/*" 2>/dev/null | head -1)

if [ -z "$PLIST_PATH" ]; then
  echo "[patch-plist] Error: Info.plist not found under build/canary*/" >&2
  exit 1
fi

echo "[patch-plist] Found: $PLIST_PATH"

# Check if already patched
if /usr/libexec/PlistBuddy -c "Print :CFBundleDocumentTypes" "$PLIST_PATH" &>/dev/null; then
  echo "[patch-plist] CFBundleDocumentTypes already present, skipping"
  exit 0
fi

echo "[patch-plist] Patching $PLIST_PATH with CFBundleDocumentTypes..."

/usr/libexec/PlistBuddy -c "Add :CFBundleDocumentTypes array" "$PLIST_PATH"
/usr/libexec/PlistBuddy -c "Add :CFBundleDocumentTypes:0 dict" "$PLIST_PATH"
/usr/libexec/PlistBuddy -c "Add :CFBundleDocumentTypes:0:CFBundleTypeName string 'Markdown Document'" "$PLIST_PATH"
/usr/libexec/PlistBuddy -c "Add :CFBundleDocumentTypes:0:CFBundleTypeRole string Editor" "$PLIST_PATH"
/usr/libexec/PlistBuddy -c "Add :CFBundleDocumentTypes:0:LSHandlerRank string Alternate" "$PLIST_PATH"
/usr/libexec/PlistBuddy -c "Add :CFBundleDocumentTypes:0:CFBundleTypeExtensions array" "$PLIST_PATH"
/usr/libexec/PlistBuddy -c "Add :CFBundleDocumentTypes:0:CFBundleTypeExtensions:0 string md" "$PLIST_PATH"
/usr/libexec/PlistBuddy -c "Add :CFBundleDocumentTypes:0:CFBundleTypeExtensions:1 string markdown" "$PLIST_PATH"
/usr/libexec/PlistBuddy -c "Add :CFBundleDocumentTypes:0:CFBundleTypeExtensions:2 string mdx" "$PLIST_PATH"
/usr/libexec/PlistBuddy -c "Add :CFBundleDocumentTypes:0:LSItemContentTypes array" "$PLIST_PATH"
/usr/libexec/PlistBuddy -c "Add :CFBundleDocumentTypes:0:LSItemContentTypes:0 string net.daringfireball.markdown" "$PLIST_PATH"

echo "[patch-plist] Done. Info.plist patched successfully."
