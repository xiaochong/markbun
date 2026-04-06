# MarkBun Architecture

## Overview

MarkBun is a Typora-like markdown desktop editor built with a modern, performant tech stack. This document describes the architecture, design decisions, and technical implementation details.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MarkBun Application                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────┐         IPC (JSON-RPC)         ┌─────────────────┐   │
│   │  MAIN PROCESS   │◄───────────────────────────────►│ RENDERER PROCESS│   │
│   │  (Electrobun)   │                                │   (WebView)     │   │
│   │                 │                                │                 │   │
│   │  • Bun Runtime  │                                │  • React        │   │
│   │  • File I/O     │                                │  • Milkdown     │   │
│   │  • OS APIs      │                                │  • CodeMirror   │   │
│   │  • Menus        │                                │  • shadcn/ui    │   │
│   └─────────────────┘                                └─────────────────┘   │
│            │                                                  │              │
│            ▼                                                  ▼              │
│   ┌─────────────────┐                                ┌─────────────────┐   │
│   │  File System    │                                │  User Interface │   │
│   │  • Read files   │                                │  • Editor       │   │
│   │  • Write files  │                                │  • Sidebar      │   │
│   │  • Watch dirs   │                                │  • Toolbar      │   │
│   │  • Backup       │                                │  • StatusBar    │   │
│   └─────────────────┘                                └─────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Technology Stack

| Layer             | Technology      | Purpose                                      |
| ----------------- | --------------- | -------------------------------------------- |
| Runtime           | Bun             | JavaScript runtime, bundler, package manager |
| Desktop Framework | Electrobun      | Cross-platform native desktop apps           |
| Editor Core       | Milkdown (Crepe)| WYSIWYG markdown editor framework            |
| Source Editor      | CodeMirror 6   | Source mode markdown editing                 |
| UI Framework      | React           | Component-based UI                           |
| UI Components     | shadcn/ui       | Accessible, customizable components          |
| Styling           | Tailwind CSS    | Utility-first CSS                            |
| Document Model    | ProseMirror     | Rich-text editing foundation                 |
| Markdown Parser   | Remark          | Markdown AST processing                      |
| Internationalization | i18next      | Multi-language support (8 languages)         |
| Validation        | Zod             | Settings schema validation                   |

## Process Architecture

### Main Process (Bun + Electrobun)

The main process runs in the Bun runtime and has full access to system APIs.

**Responsibilities:**

* Window management (create, resize, close)
* Native menus (application menu, context menu)
* File system operations (read, write, watch)
* Three-layer backup and recovery system
* Auto-updater
* Internationalization (menu translations)

**Key APIs:**

```typescript
import Electrobun, {
  BrowserWindow,
  BrowserView,
  Updater,
  Utils,
  ApplicationMenu,
  ContextMenu,
  Screen
} from "electrobun/bun";
```

### Renderer Process (WebView)

The renderer runs in a native WebView and renders the UI using React.

**Responsibilities:**

* Render the editor UI
* Handle user input
* Display markdown content
* Manage local UI state

**Key APIs:**

```typescript
import { Electroview } from "electrobun/view";
```

### IPC Communication

Main and renderer communicate via JSON-RPC through Electrobun's IPC system.

```
Renderer ──► BrowserView.defineRPC (typed request handlers) ──► Main
Main ──────► webview.rpc.send.messageName(params) ────────────► Renderer
```

**Request RPCs (Renderer → Main):**

* **File operations**: `openFile`, `openFolder`, `saveFile`, `saveFileAs`, `readFile`, `readFolder`, `getCurrentFile`, `getPendingFile`
* **File management**: `createFile`, `createFolder`, `deleteFile`, `moveFile`, `renameFile`, `openInFinder`, `fileExists`, `getFileStats`
* **Recent files**: `getRecentFiles`, `addRecentFile`, `removeRecentFile`, `clearRecentFiles`, `quickOpen`
* **Settings & UI state**: `getSettings`, `saveSettings`, `getUIState`, `saveUIState`, `updateWindowBounds`
* **Backup & recovery**: `checkRecovery`, `clearRecovery`, `recoverFile`, `writeRecovery`, `getVersionBackups`, `restoreVersionBackup`, `deleteVersionBackup`
* **Image handling**: `readImageAsBase64`, `selectImageFile`, `saveDroppedImage`
* **Export**: `saveExportedFile`
* **Clipboard**: `writeToClipboard`, `readFromClipboard`
* **i18n**: `setLanguage`, `getSystemLanguage`
* **Dialogs**: `showConfirmationDialog`, `showUnsavedChangesDialog`, `showPromptDialog`, `listFolder`, `getParentFolder`, `saveFileWithPath`

**Messages (Main → Renderer):**

`fileOpened`, `folderOpened`, `fileNew`, `fileSaveRequest`, `fileSaveAsRequest`, `fileOpenRequest`, `toggleTheme`, `showAbout`, `toggleTitlebar`, `toggleToolbar`, `toggleStatusbar`, `toggleSidebar`, `openQuickOpen`, `openSettings`, `toggleSourceMode`, `openFileHistory`, `menuAction`, `languageChanged`

## Component Architecture

### Editor Component Hierarchy

```
App
├── TitleBar (conditionally rendered)
├── Main Content Area (flex row)
│   ├── Sidebar (conditionally rendered, tabbed)
│   │   ├── FileExplorer (files tab)
│   │   └── Outline (outline tab)
│   │
│   └── Editor Area (flex col, flex-1)
│       ├── Toolbar (conditionally rendered)
│       ├── Editor (one of three modes):
│       │   ├── MilkdownEditor (WYSIWYG mode)
│       │   ├── SourceEditor (source mode, CodeMirror 6)
│       │   └── ImageViewer (image preview)
│       └── StatusBar (conditionally rendered)
│
└── Dialogs (all conditionally rendered)
    ├── QuickOpen (Cmd+P file finder)
    ├── ImageInsertDialog
    ├── SettingsDialog
    ├── FileDialog (open/save)
    ├── RecoveryDialog
    ├── FileHistoryDialog
    ├── SaveDialog
    └── AboutDialog
```

Note: TitleBar, Toolbar, StatusBar, and Sidebar visibility is toggled via the View menu and persisted in UI state.

### Milkdown Integration

Milkdown is integrated via **Crepe** (a high-level Milkdown wrapper) as a React component wrapping the ProseMirror editor.

```
MilkdownEditor (React Component, forwardRef + memo)
├── useCrepeEditor (custom hook)
│   ├── Crepe (from @milkdown/crepe)
│   │   ├── Feature config:
│   │   │   ├── BlockEdit: disabled
│   │   │   ├── LinkTooltip: enabled
│   │   │   ├── Toolbar: disabled (custom Toolbar used)
│   │   │   ├── ImageBlock: enabled (with custom onUpload, proxyDomURL)
│   │   │   └── CodeMirror: enabled (with Mermaid diagram rendering)
│   │   │
│   │   └── Plugins:
│   │       ├── clipboard (@milkdown/plugin-clipboard)
│   │       ├── history (@milkdown/plugin-history)
│   │       ├── gfm (@milkdown/preset-gfm)
│   │       ├── clipboardBlobConverter (custom — blob URL handling)
│   │       ├── inlineMarksPlugin (custom — highlight, superscript, subscript)
│   │       ├── breaksPlugin (custom — soft line breaks)
│   │       └── inlineMarksParsersPlugin (custom — remarkHighlight, remarkSuperSub)
│   │
│   └── Content loading:
│       ├── Direct parse (< 500 lines)
│       └── Chunked loading (>= 500 lines, code-block-aware splitting)
│
├── useThemeLoader (custom hook)
│   ├── @milkdown/crepe/theme/frame.css (light mode)
│   └── @milkdown/crepe/theme/frame-dark.css (dark mode)
│
├── useContextMenu (custom hook)
│
└── Style imports:
    ├── @milkdown/crepe/theme/common/style.css
    └── @milkdown/crepe/theme/common/link-tooltip.css
```

### Source Editor (CodeMirror 6)

Used in source mode as an alternative to the WYSIWYG editor:

```
SourceEditor (React Component)
├── EditorView + EditorState
├── @codemirror/lang-markdown
├── @codemirror/theme-one-dark (dark mode)
├── Extensions: lineNumbers, history, search, bracketMatching
└── Custom syntax highlighting for light/dark themes
```

## Data Flow

### File Open Flow

```
1. User clicks "Open" menu or Cmd+O
   ↓
2. Main: ApplicationMenu triggers "file-open" action
   ↓
3. Main: Show native file picker dialog
   ↓
4. User selects file
   ↓
5. Main: Read file content via readFile RPC
   ↓
6. Main: Send to renderer via IPC
   ↓
7. Renderer: Update editor content
   ↓
8. Renderer: Update title bar
```

### Auto-Save Flow

```
1. Editor content changes (ProseMirror transaction)
   ↓
2. Renderer: Debounce (configurable interval, default 2000ms)
   ↓
3. Renderer: Serialize to markdown
   ↓
4. Renderer: Call saveFile RPC
   ↓
5. Main: Write recovery file (crash protection)
   ↓
6. Main: Create version backup (if enabled)
   ↓
7. Main: Atomic write via .tmp + rename
   ↓
8. Main: Clear recovery file
   ↓
9. Renderer: Update save status indicator
```

### Theme Switching Flow

```
1. User toggles dark/light mode
   ↓
2. Renderer: Update React state
   ↓
3. Renderer: Apply CSS class to root
   ↓
4. Renderer: Load Crepe theme CSS dynamically
   ↓
5. Renderer: Notify main via IPC
   ↓
6. Main: Persist preference to settings file
```

## State Management

### Local Component State (React useState)

Used for UI-specific state that doesn't need to persist:

* Sidebar open/closed
* Active panel in sidebar
* Toolbar button hover states
* Dialog visibility

### Editor State (ProseMirror)

Managed internally by Milkdown/ProseMirror:

* Document content (JSON tree)
* Selection state
* Undo/redo history
* Plugin states

Accessed via:

```typescript
editor.action(ctx => {
  const view = ctx.get(editorViewCtx);
  const state = view.state;
  // ...
});
```

### Global Settings

Persisted to disk using a Zod-validated nested schema. Loaded on startup.

```typescript
interface Settings {
  __version: 1;
  general: {
    autoSave: boolean;         // default: true
    autoSaveInterval: number;  // 500-30000ms, default: 2000
    language: 'en' | 'zh-CN' | 'de' | 'fr' | 'ja' | 'ko' | 'pt' | 'es';
  };
  editor: {
    fontSize: number;   // 10-32, default: 15
    lineHeight: number; // 1-3, default: 1.65
  };
  appearance: {
    theme: 'light' | 'dark' | 'system';  // default: 'system'
    sidebarWidth: number;                  // 150-500, default: 280
  };
  backup: {
    enabled: boolean;           // default: true
    maxVersions: number;        // 5-100, default: 20
    retentionDays: number;      // 1-365, default: 30
    recoveryInterval: number;   // 5000-120000ms, default: 30000
  };
}
```

### UI State

Separate from settings — stores ephemeral window/layout state:

```typescript
interface UIState {
  showTitleBar: boolean;
  showToolBar: boolean;
  showStatusBar: boolean;
  showSidebar: boolean;
  sourceMode: boolean;
  sidebarWidth: number;
  sidebarActiveTab: 'files' | 'outline' | 'search';
  windowX: number;
  windowY: number;
  windowWidth: number;
  windowHeight: number;
  displayId?: number;
}
```

### Storage Locations

All platforms use a unified path:

* Settings: `~/.config/markbun/settings.json`
* UI state: `~/.config/markbun/ui-state.json`
* Recovery files: `~/.config/markbun/recovery/`
* Version backups: `~/.config/markbun/backups/`

## Backup & Recovery System

Three-layer file protection system in `src/bun/services/backup.ts`:

1. **Atomic Write** — Write to `.tmp` then rename, prevents corruption from interrupted writes
2. **Crash Recovery** — Write recovery file before save, clear after success. Stored as JSON with `{originalPath, timestamp, content}`
3. **Version History** — Snapshot before each save, auto-pruned by `retentionDays` and `maxVersions`

## Internationalization

Multi-language support using i18next:

* **Main process**: `src/bun/i18n/` — menu translations in 8 locales (en, zh-CN, de, es, fr, ja, ko, pt)
* **Renderer process**: `src/mainview/i18n/` — UI translations
* **Shared**: `src/shared/i18n/config.ts` — language resolution logic
* Language preference saved in settings; menu rebuilt on change

## Image Handling

Pipeline for displaying and saving images in the editor:

* **Local image path resolution** via `workspaceManager`
* **Blob URL conversion** for display in WebView (security requirement)
* **Original path restoration** on save via `restoreOriginalImagePaths`
* **Image cache** (`imageCache.ts`) for blob URL reuse
* **Drag-and-drop** saves images to workspace `assets/` directory

## Styling Architecture

### Layering System

```
1. Tailwind CSS (base utilities via @tailwind directives)
   ↓
2. CSS Variables for theming (shadcn-compatible variables in :root/.dark)
   ↓
3. Crepe theme styles (@milkdown/crepe/theme/common/style.css, frame.css/frame-dark.css)
   ↓
4. Crepe link tooltip styles (@milkdown/crepe/theme/common/link-tooltip.css)
   ↓
5. MarkBun custom styles (all in src/mainview/index.css)
```

### CSS Variables

```css
:root {
  --background: 0 0% 100%;
  --foreground: 240 10% 3.9%;
  --card: 0 0% 100%;
  --card-foreground: 240 10% 3.9%;
  --popover: 0 0% 100%;
  --popover-foreground: 240 10% 3.9%;
  --primary: 240 5.9% 10%;
  --primary-foreground: 0 0% 98%;
  --secondary: 240 4.8% 95.9%;
  --secondary-foreground: 240 5.9% 10%;
  --muted: 240 4.8% 95.9%;
  --muted-foreground: 240 3.8% 46.1%;
  --accent: 240 4.8% 95.9%;
  --accent-foreground: 240 5.9% 10%;
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 0 0% 98%;
  --border: 240 5.9% 90%;
  --input: 240 5.9% 90%;
  --ring: 240 5.9% 10%;
  --radius: 0.5rem;
}

.dark {
  --background: 220 13% 24%;
  --foreground: 210 20% 96%;
  --card: 220 13% 24%;
  --card-foreground: 210 20% 96%;
  --popover: 220 13% 24%;
  --popover-foreground: 210 20% 96%;
  --primary: 210 20% 96%;
  --primary-foreground: 220 13% 24%;
  --secondary: 220 10% 32%;
  --secondary-foreground: 210 20% 96%;
  --muted: 220 10% 32%;
  --muted-foreground: 220 8% 65%;
  --accent: 220 10% 32%;
  --accent-foreground: 210 20% 96%;
  --destructive: 0 62.8% 40%;
  --destructive-foreground: 0 0% 98%;
  --border: 220 10% 32%;
  --input: 220 10% 32%;
  --ring: 210 20% 80%;
}
```

### Style Source

All custom styles are in a single file `src/mainview/index.css` (~1300 lines), covering: editor chrome, code blocks, drag-and-drop overlay, scrollbar auto-hide, image blocks, dialogs, sidebar, toolbar, status bar, outline, quick-open, file dialog, settings, and recovery dialog.

Crepe theme styles are loaded dynamically via `useThemeLoader` hook from npm packages.

## File Organization

```
markbun/
├── src/
│   ├── bun/                         # Main process (Electrobun/Bun)
│   │   ├── index.ts                 # Main entry, window mgmt, RPC handlers
│   │   ├── menu.ts                  # Application menus
│   │   ├── assets/
│   │   │   └── helpContent.ts       # Help document content
│   │   ├── i18n/
│   │   │   ├── index.ts             # i18next setup
│   │   │   └── locales/             # Menu translations (8 languages)
│   │   │       ├── en/menu.json
│   │   │       ├── zh-CN/menu.json
│   │   │       └── ... (de, es, fr, ja, ko, pt)
│   │   ├── ipc/
│   │   │   ├── files.ts             # File I/O operations
│   │   │   ├── folders.ts           # Folder tree reading
│   │   │   └── recentFiles.ts       # Recent files management
│   │   ├── lib/                     # Main process utilities
│   │   └── services/
│   │       ├── settings.ts          # Settings load/save/migrate
│   │       ├── backup.ts            # Three-layer backup service
│   │       └── uiState.ts           # UI state persistence
│   │
│   ├── mainview/                    # Renderer process (WebView)
│   │   ├── main.tsx                 # React entry point
│   │   ├── App.tsx                  # Main application component
│   │   ├── index.html               # HTML entry
│   │   ├── index.css                # All styles (~1300 lines)
│   │   ├── components/
│   │   │   ├── editor/              # Editor components
│   │   │   │   ├── MilkdownEditor.tsx
│   │   │   │   ├── SourceEditor.tsx  # CodeMirror 6 source mode
│   │   │   │   ├── commands/        # Editor command functions
│   │   │   │   ├── hooks/           # useCrepeEditor, useContextMenu, useThemeLoader
│   │   │   │   ├── plugins/         # clipboardBlobConverter, inlineMarksPlugin, etc.
│   │   │   │   └── utils/           # editorActions, tableHelpers
│   │   │   ├── file-explorer/       # File tree browser
│   │   │   │   ├── FileExplorer.tsx
│   │   │   │   ├── FileTree.tsx
│   │   │   │   ├── ContextMenu.tsx
│   │   │   │   └── MoveDialog.tsx
│   │   │   ├── file-dialog/         # Custom open/save dialog
│   │   │   ├── file-history/        # Version history dialog
│   │   │   ├── image-insert/        # Image insert dialog
│   │   │   ├── image-viewer/        # Image preview
│   │   │   ├── layout/              # TitleBar, Toolbar, Sidebar, StatusBar
│   │   │   ├── outline/             # Document outline view
│   │   │   ├── quick-open/          # Quick file opener (Cmd+P)
│   │   │   ├── recovery-dialog/     # Crash recovery dialog
│   │   │   ├── save-dialog/         # Unsaved changes dialog
│   │   │   ├── settings/            # Settings dialog
│   │   │   ├── about/               # About dialog
│   │   │   └── ui/                  # shadcn/ui components
│   │   ├── hooks/                   # App-level custom hooks
│   │   │   ├── useAutoSave.ts
│   │   │   ├── useClipboard.ts
│   │   │   ├── useExport.ts
│   │   │   ├── useFileExplorer.ts
│   │   │   ├── useFileOperations.ts
│   │   │   ├── useOutline.ts
│   │   │   ├── useQuickOpen.ts
│   │   │   ├── useSidebar.ts
│   │   │   └── useTheme.ts
│   │   ├── lib/                     # Renderer utilities
│   │   │   ├── electrobun.ts        # IPC wrapper
│   │   │   ├── commandHandlers.ts  # Unified command handler registration
│   │   │   ├── image.ts             # Image processing (workspace, blob URLs)
│   │   │   ├── imageCache.ts        # Image blob URL cache
│   │   │   ├── imageProcessor.ts
│   │   │   └── utils.ts
│   │   ├── i18n/                    # Renderer-side translations
│   │   │   ├── index.ts
│   │   │   └── locales/             # UI translations (8 languages)
│   │   └── images/
│   │       └── logo.svg
│   │
│   └── shared/                      # Shared between processes
│       ├── types.ts                 # RPC schema, shared interfaces
│       ├── commandRegistry.ts      # Command manifest (single source of truth for all commands)
│       ├── commandDispatch.ts      # Unified command dispatcher
│       ├── settings/
│       │   └── schema.ts            # Zod settings schema + defaults
│       └── i18n/
│           ├── config.ts            # Language resolution logic
│           └── types.ts             # i18n type definitions
│
├── docs/                            # Documentation
│   ├── architecture.md
│   ├── architecture-cn.md
│   ├── file-association.md
│   └── file-association-cn.md
│
├── scripts/                         # Build scripts
│   ├── create-dmg.sh
│   ├── create-wrapper.sh
│   ├── patch-plist.sh
│   ├── post-build.ts
│   └── typecheck.sh
│
├── tests/                           # Tests
│   └── unit/
│
├── electrobun.config.ts             # Electrobun configuration
├── vite.config.ts                   # Vite configuration
├── tailwind.config.js               # Tailwind configuration
├── postcss.config.js                # PostCSS configuration
├── tsconfig.json
├── package.json
└── README.md
```

## Build System

### Electrobun Configuration

```typescript
// electrobun.config.ts
import type { ElectrobunConfig } from "electrobun";

// CEF is only needed in dev mode for debugging
const isBuild = process.argv.some(arg => arg === "build");

export default {
  app: {
    name: "MarkBun",
    identifier: "dev.markbun.app",
    version: "0.1.0",
    urlSchemes: ["markbun"],
  },
  build: {
    copy: {
      "dist/index.html": "views/mainview/index.html",
      "dist/assets": "views/mainview/assets",
      "src/mainview/images": "views/mainview/images",
    },
    watchIgnore: ["dist/**"],
    mac: {
      bundleCEF: !isBuild,
    },
    linux: {
      bundleCEF: true,
      icon: "icon.iconset/icon_256x256.png",
    },
    win: {
      bundleCEF: false,
      icon: "icon.iconset/icon_256x256.png",
    },
  },
} satisfies ElectrobunConfig;
```
