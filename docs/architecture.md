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
│   │  • OS APIs      │                                │  • shadcn/ui    │   │
│   │  • Menus        │                                │                 │   │
│   └─────────────────┘                                └─────────────────┘   │
│            │                                                  │              │
│            ▼                                                  ▼              │
│   ┌─────────────────┐                                ┌─────────────────┐   │
│   │  File System    │                                │  User Interface │   │
│   │  • Read files   │                                │  • Editor       │   │
│   │  • Write files  │                                │  • Sidebar      │   │
│   │  • Watch dirs   │                                │  • Toolbar      │   │
│   └─────────────────┘                                │  • StatusBar    │   │
│                                                      └─────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Runtime | Bun | JavaScript runtime, bundler, package manager |
| Desktop Framework | Electrobun | Cross-platform native desktop apps |
| Editor Core | Milkdown | WYSIWYG markdown editor framework |
| UI Framework | React | Component-based UI |
| UI Components | shadcn/ui | Accessible, customizable components |
| Styling | Tailwind CSS | Utility-first CSS |
| Document Model | ProseMirror | Rich-text editing foundation |
| Markdown Parser | Remark | Markdown AST processing |

## Process Architecture

### Main Process (Bun + Electrobun)

The main process runs in the Bun runtime and has full access to system APIs.

**Responsibilities:**
- Window management (create, resize, close)
- Native menus (application menu, context menu)
- File system operations (read, write, watch)
- System integration (tray, notifications)
- Auto-updater

**Key APIs:**
```typescript
import { 
  BrowserWindow, 
  ApplicationMenu,
  Tray,
  Updater 
} from "electrobun/bun";
```

### Renderer Process (WebView)

The renderer runs in a native WebView and renders the UI using React.

**Responsibilities:**
- Render the editor UI
- Handle user input
- Display markdown content
- Manage local UI state

**Key APIs:**
```typescript
import { Electroview } from "electrobun/view";
```

### IPC Communication

Main and renderer communicate via JSON-RPC through Electrobun's IPC system.

```
Renderer ──► Electroview.rpc("action", data) ──► Main
Main ──────► webview.send("event", data) ──────► Renderer
```

**IPC Channels:**
- `file:open` - Open file dialog
- `file:read` - Read file contents
- `file:save` - Save file contents
- `file:watch` - Watch file for changes
- `menu:action` - Menu item clicked
- `window:state` - Window state changes

## Component Architecture

### Editor Component Hierarchy

```
App
├── RootLayout
│   ├── TitleBar
│   │   └── [Window controls, document title]
│   │
│   ├── MainContainer (flex row)
│   │   ├── Sidebar (collapsible)
│   │   │   ├── FileExplorer
│   │   │   └── OutlineView
│   │   │
│   │   └── EditorArea (flex col, flex-1)
│   │       ├── Toolbar
│   │       │   ├── FormatButtons
│   │       │   ├── InsertMenu
│   │       │   └── ModeToggle
│   │       │
│   │       ├── MilkdownEditor
│   │       │   ├── ProseMirror View
│   │       │   ├── SlashCommand
│   │       │   └── Tooltip
│   │       │
│   │       └── StatusBar
│   │           ├── WordCount
│   │           ├── SyncStatus
│   │           └── FileInfo
│   │
│   └── CommandPalette (overlay)
│
└── Dialogs
    ├── SettingsDialog
    ├── ImageUploadDialog
    └── LinkEditDialog
```

### Milkdown Integration

Milkdown is integrated as a React component wrapping the ProseMirror editor.

```
MilkdownEditor (React Component)
├── useMilkdown (custom hook)
│   ├── Editor.make()
│   │   ├── Config (ctx)
│   │   ├── Schema (nodes, marks)
│   │   ├── Parser (markdown → ProseMirror)
│   │   ├── Serializer (ProseMirror → markdown)
│   │   ├── Commands
│   │   ├── Keymap
│   │   └── EditorView (DOM)
│   │
│   └── Plugins
│       ├── commonmark (basic syntax)
│       ├── gfm (GitHub flavored)
│       ├── history (undo/redo)
│       ├── clipboard (copy/paste)
│       ├── math (LaTeX)
│       ├── table (GFM tables)
│       ├── slash (command palette)
│       └── emoji (emoji picker)
│
└── Theme Styles
    ├── prose-mirror.css (base)
    ├── milkdown.css (custom)
    └── shadcn-theme.css (colors)
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
5. Main: Read file content
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
2. Renderer: Debounce 1 second
   ↓
3. Renderer: Serialize to markdown
   ↓
4. Renderer: Call IPC "file:save"
   ↓
5. Main: Write to file system
   ↓
6. Main: Confirm save success
   ↓
7. Renderer: Update "saved" indicator in status bar
```

### Theme Switching Flow

```
1. User toggles dark/light mode
   ↓
2. Renderer: Update React state
   ↓
3. Renderer: Apply CSS class to root
   ↓
4. Renderer: Notify main via IPC
   ↓
5. Main: Persist preference to settings file
   ↓
6. Main: Update native window chrome (macOS)
```

## State Management

### Local Component State (React useState)

Used for UI-specific state that doesn't need to persist:
- Sidebar open/closed
- Active panel in sidebar
- Toolbar button hover states
- Dialog visibility

### Editor State (ProseMirror)

Managed internally by Milkdown/ProseMirror:
- Document content (JSON tree)
- Selection state
- Undo/redo history
- Plugin states

Accessed via:
```typescript
editor.action(ctx => {
  const view = ctx.get(editorViewCtx);
  const state = view.state;
  // ...
});
```

### Global Settings

Persisted to disk and loaded on startup:
```typescript
interface Settings {
  theme: "light" | "dark" | "system";
  fontSize: number;
  lineHeight: number;
  autoSave: boolean;
  autoSaveInterval: number;
  showLineNumbers: boolean;
  wordWrap: boolean;
  recentFiles: string[];
  lastOpenFolder: string;
}
```

Stored in:
- macOS: `~/Library/Application Support/MarkBun/settings.json`
- Windows: `%APPDATA%/MarkBun/settings.json`
- Linux: `~/.config/MarkBun/settings.json`

## Styling Architecture

### Layering System

```
1. Tailwind CSS (base utilities)
   ↓
2. shadcn/ui Theme (CSS variables)
   ↓
3. ProseMirror Base Styles
   ↓
4. Milkdown Styles
   ↓
5. MarkBun Custom Styles
```

### CSS Variables (shadcn/ui Theme)

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
  --background: 240 10% 3.9%;
  --foreground: 0 0% 98%;
  /* ... dark mode values ... */
}
```

### Milkdown Editor Styling

Custom styles for the seamless editing experience:

```css
/* Hide markdown syntax when not focused */
.milkdown .paragraph {
  position: relative;
}

.milkdown .paragraph::before {
  content: "";
  position: absolute;
  /* ... */
}

/* Live preview for links */
.milkdown .link {
  color: var(--primary);
  text-decoration: none;
}

.milkdown .link:hover {
  text-decoration: underline;
}

/* Code blocks */
.milkdown pre {
  background: var(--muted);
  border-radius: var(--radius);
  padding: 1rem;
}
```

## File Organization

```
markbun/
├── src/
│   ├── bun/                  
│   │   ├── index.ts          # Main process (Electrobun/Bun)
│   │   ├── menu.ts           # Application menus
│   │   ├── window.ts         # Window management
│   │   └── ipc/              # IPC handlers
│   │
│   ├── mainview/             # Renderer process (WebView)
│   │   ├── components/       # React components
│   │   │   ├── editor/       # Milkdown editor wrapper
│   │   │   ├── sidebar/      # File explorer
│   │   │   ├── toolbar/      # Editor toolbar
│   │   │   └── statusbar/    # Status bar
│   │   │
│   │   ├── hooks/            # Custom React hooks
│   │   ├── lib/              # Utilities
│   │   ├── styles/           # Global styles
│   │   ├── main.tsx        # React entry point
│   │   ├── App.tsx           # Main App component
│   │   └── index.html        # HTML entry
│   │
│   └── shared/               # Shared types and utilities
│
├── doc/                      # Documentation
│   ├── architecture.md       # Architecture overview
│   └── assets/               # Documentation assets
│
├── resources/                # Static resources
│   ├── icons/                # App icons
│   └── themes/               # Editor themes
│
├── electrobun.config.ts      # Electrobun configuration
├── components.json           # shadcn/ui configuration
├── vite.config.ts          # Vite configuration
├── tailwind.config.js      # Tailwind configuration
├── package.json
└── README.md
```

## Build System

### Electrobun Configuration

```typescript
// electrobun.config.ts
import type { ElectrobunConfig } from "electrobun";

export default {
  app: {
    name: "react-tailwind-vite",
    identifier: "reacttailwindvite.electrobun.dev",
    version: "0.0.1",
  },
  build: {
    // Vite builds to dist/, we copy from there
    copy: {
      "dist/index.html": "views/mainview/index.html",
      "dist/assets": "views/mainview/assets",
    },
    // Ignore Vite output in watch mode — HMR handles view rebuilds separately
    watchIgnore: ["dist/**"],
    mac: {
      bundleCEF: false,
    },
    linux: {
      bundleCEF: false,
    },
    win: {
      bundleCEF: false,
    },
  },
} satisfies ElectrobunConfig;
```

### Build Process

```bash
# Development
bun dev
# 1. Start Electrobun dev server
# 2. Watch for file changes
# 3. Hot reload renderer
# 4. Restart main on changes

# Production build
bun run build
# 1. Type check with tsc
# 2. Bundle main process with Bun
# 3. Bundle renderer with Bun
# 4. Copy resources
# 5. Package for target platform

# Cross-platform builds
bun run build:macos
bun run build:windows
bun run build:linux
```

## Performance Considerations

### Editor Performance

- **Virtual Scrolling**: For very large documents, render only visible content
- **Debounced Saves**: Auto-save triggers 1 second after typing stops
- **Lazy Plugins**: Load heavy plugins (math, diagrams) on demand
- **Image Optimization**: Resize large images before rendering

### Memory Management

- Dispose Milkdown editor on component unmount
- Clear file watchers when closing folders
- Limit undo history to 100 steps
- Use WeakMap for plugin state where appropriate

### Bundle Size

- Tree-shake unused Milkdown plugins
- Lazy load dialog components
- Use dynamic imports for heavy features
- Minimize CSS with PurgeCSS

## Security

### IPC Security

- Validate all IPC message payloads
- Whitelist allowed file operations
- Sanitize file paths (prevent directory traversal)
- Use native file dialogs (don't trust renderer paths)

### Content Security

- Sanitize pasted HTML content
- Validate image URLs before loading
- Use `sandbox` attribute on webviews
- Disable `nodeIntegration` in renderer

## Extension Points

### Custom Milkdown Plugins

Create plugins in `src/renderer/components/editor/plugins/`:

```typescript
// my-plugin.ts
import { $prose } from "@milkdown/utils";
import { Plugin } from "prosemirror-state";

export const myPlugin = $prose(() => {
  return new Plugin({
    state: { /* ... */ },
    props: { /* ... */ },
  });
});
```

### Custom shadcn Themes

Add theme files to `resources/themes/`:

```css
/* resources/themes/my-theme.css */
:root {
  --font-serif: "Merriweather", serif;
  --color-primary: #e74c3c;
  /* ... */
}
```

### Main Process Extensions

Add IPC handlers in `src/main/ipc/`:

```typescript
// custom-handlers.ts
export function registerCustomHandlers(electrobun) {
  electrobun.handle("custom:action", async (data) => {
    // Implementation
    return result;
  });
}
```

## Testing Strategy

### Unit Tests

```typescript
// src/renderer/components/editor/MilkdownEditor.test.tsx
import { render, screen } from "@testing-library/react";
import { MilkdownEditor } from "./MilkdownEditor";

test("renders editor with content", () => {
  render(<MilkdownEditor initialValue="# Hello" />);
  expect(screen.getByRole("textbox")).toBeInTheDocument();
});
```

### Integration Tests

Test IPC communication:
```typescript
// tests/ipc.test.ts
test("file:open returns file content", async () => {
  const result = await ipc.invoke("file:open", "/test.md");
  expect(result.content).toBe("# Test");
});
```

### E2E Tests

Use Playwright for end-to-end testing:
```typescript
test("user can type and save", async ({ page }) => {
  await page.goto("app://index.html");
  await page.type("[contenteditable]", "# Hello World");
  await page.keyboard.press("Control+s");
  // Assert file saved
});
```

## Future Considerations

### Planned Features

- **Plugin System**: Allow third-party plugins
- **Cloud Sync**: iCloud, Dropbox, Git integration
- **Collaboration**: Real-time collaborative editing via Y.js
- **Vim Mode**: Modal editing support
- **Command Palette**: VS Code-style command palette

### Scalability

- Split large documents into sections
- Lazy load folder contents in sidebar
- Database for file indexing (if needed)
- Worker threads for heavy operations

---

*Last updated: 2026-03-08*
