# macOS File Association Implementation

## Overview

Users can double-click `.md`, `.markdown`, and `.mdx` files in macOS Finder to automatically open them in MarkBun and load the file content.

## Architecture

Since the Electrobun framework **does not support** `application:openFile:` Apple Events, we use a **Wrapper App + File IPC** approach:

```
┌─────────────────────────────────┐
│         MarkBun.app (Wrapper)    │
│  ┌───────────────────────────┐  │
│  │  AppleScript droplet      │  │  Receives macOS file-open events
│  │  CFBundleDocumentTypes    │  │  → writes /tmp/markbun/pending.txt
│  └───────────────────────────┘  │  → launches inner main app
│  ┌───────────────────────────┐  │
│  │  Contents/MacOS/          │  │
│  │    MarkBun-canary.app/    │  │  Electrobun main app
│  │      → checks pending file│  │  → renderer opens file
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

## Components

### 1. MarkBun Wrapper (AppleScript Droplet)

**Location**: `build/MarkBun.app`

**Responsibilities**:

- Registers as the handler for `.md`/`.markdown`/`.mdx` files (via `CFBundleDocumentTypes`)
- Receives macOS file-open events
- Writes the file path to `/tmp/markbun/pending.txt`
- Launches or activates the inner Electrobun main app

**Source**: `scripts/create-wrapper.sh`

```applescript
on open theFiles
    set filePath to POSIX path of (item 1 of theFiles)
    do shell script "echo " & quoted form of filePath & " > /tmp/markbun/pending.txt"
    set appPath to POSIX path of (path to me) & "Contents/MacOS/MarkBun-canary.app"
    do shell script "open " & quoted form of appPath
end open
```

### 2. IPC File

**Path**: `/tmp/markbun/pending.txt`

**Responsibilities**:

- The Wrapper writes the file path to be opened
- The main app reads and immediately deletes it (to prevent re-opening)
- Automatically cleaned up on system restart

### 3. Main App Processing Logic

**File**: `src/bun/index.ts`

**Startup consumption** (when the app is not running):
```typescript
const filePath = await consumePendingFile();
if (filePath) pendingOpenFilePath = filePath;
```

**Runtime listener** (when the app is already running, using `fs.watch` event-driven):
```typescript
watch('/tmp/markbun', (eventType, filename) => {
  if (filename !== 'pending.txt') return;
  const filePath = await consumePendingFile();
  if (filePath) openFileInFocusedWindow(filePath);
});
```

**Renderer retrieval**:
```typescript
// RPC: getPendingFile
getPendingFile: async () => {
  if (!pendingOpenFilePath) return null;
  const filePath = pendingOpenFilePath;
  pendingOpenFilePath = null;
  return { path: filePath, content: ... };
}
```

### 4. URL Scheme (Auxiliary Approach)

**Purpose**: When the main app **is already running**, files can be opened directly via URL scheme

**Format**: `markbun://open?path=/path/to/file.md`

**Listener**:
```typescript
Electrobun.events.on('open-url', (event) => {
  const url = new URL(event.data.url);
  if (url.hostname === 'open') {
    const filePath = decodeURIComponent(url.searchParams.get('path') ?? '');
    if (filePath) openFileInFocusedWindow(filePath);
  }
});
```

## Why Not Apple Events?

The Electrobun framework's launcher is a pre-compiled Zig binary that does not implement the `application:openFile:` delegate. Apple Events sent by macOS when double-clicking a file cannot be received by the app.

## Why a Wrapper?

Electrobun's startup chain is `Zig binary → Bun main.js → Worker (app code)`. Command-line arguments are not passed through to the Worker layer, so file paths from Finder cannot be processed directly.

## Build Process

`scripts/post-build.ts` runs automatically after a macOS build:

1. `create-wrapper.sh` - Creates the Wrapper App (embedding the main app + file association declarations)
2. `create-dmg.sh` - Packages the DMG

## Installation

1. Drag `MarkBun.app` from the DMG to `/Applications/`
2. Right-click any `.md` file → "Open With" → "MarkBun"
3. Check "Always Open With"

## Related Files

| File | Purpose |
|------|---------|
| `electrobun.config.ts` | Configures `urlSchemes: ["markbun"]` |
| `src/bun/index.ts` | Main process file, handles IPC and URL scheme |
| `src/mainview/App.tsx` | Renderer process, calls `getPendingFile` on startup |
| `src/mainview/lib/electrobun.ts` | RPC interface definitions |
| `scripts/create-wrapper.sh` | Creates the Wrapper App |
| `scripts/create-dmg.sh` | Packages the DMG |
