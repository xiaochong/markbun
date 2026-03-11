# AGENTS.md - PingWrite Development Guide

## Project Overview

**PingWrite** is a Typora-like markdown desktop editor built with:
- **Milkdown**: WYSIWYG markdown editor framework
- **Electrobun**: Bun + WebView cross-platform desktop framework  
- **shadcn/ui**: React component library
- **TypeScript**: Type-safe development

## Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────────┐
│                      PingWrite Application                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    IPC      ┌──────────────────────────────┐  │
│  │  Main Process│◄───────────►│     Renderer Process         │  │
│  │  (Electrobun)│   (JSON)    │     (WebView + React)        │  │
│  │  Bun Runtime │             │                              │  │
│  └──────────────┘             │  ┌────────────────────────┐   │  │
│         │                     │  │     Milkdown Editor    │   │  │
│         ▼                     │  │  ┌──────────────────┐  │   │  │
│  ┌──────────────┐             │  │  │   ProseMirror    │  │   │  │
│  │   OS APIs    │             │  │  │   Document Model │  │   │  │
│  │  File System │             │  │  └──────────────────┘  │   │  │
│  │    Menus     │             │  └────────────────────────┘   │  │
│  │   Windows    │             │                               │  │
│  └──────────────┘             │  ┌────────────────────────┐   │  │
│                               │  │    shadcn/ui Components│   │  │
│                               │  │  - Toolbar             │   │  │
│                               │  │  - Sidebar             │   │  │
│                               │  │  - Status Bar          │   │  │
│                               │  │  - Dialogs             │   │  │
│                               │  └────────────────────────┘   │  │
│                               └───────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Tech Stack Details

### 1. Milkdown

Milkdown is a plugin-driven WYSIWYG markdown editor built on ProseMirror.

**Key Concepts:**
- **Editor**: Core class that manages the editor lifecycle
- **Plugins**: Everything is a plugin (syntax, themes, UI features)
- **Ctx**: Context system for sharing data between plugins
- **ProseMirror**: Underlying document model and editing engine
- **Remark**: Markdown parser/serializer

**Usage Pattern for PingWrite:**
```typescript
import { Editor } from "@milkdown/kit/core";
import { commonmark } from "@milkdown/kit/preset/commonmark";
import { gfm } from "@milkdown/kit/preset/gfm";
import { history } from "@milkdown/kit/plugin/history";

Editor.make()
  .use(commonmark)
  .use(gfm)
  .use(history)
  .create();
```

**Required Plugins:**
- `@milkdown/kit/preset/commonmark` - Basic markdown
- `@milkdown/kit/preset/gfm` - GitHub Flavored Markdown
- `@milkdown/kit/plugin/history` - Undo/redo
- `@milkdown/kit/plugin/clipboard` - Copy/paste
- `@milkdown/plugin-math` - LaTeX math
- `@milkdown/plugin-slash` - Command palette

### 2. Electrobun

Electrobun is a desktop framework using Bun as the backend and native WebView as the renderer.

**Key Concepts:**
- **BrowserWindow**: Native window management
- **BrowserView**: WebView containers
- **Electroview**: Browser-side API to communicate with main process
- **views:// protocol**: Custom protocol for loading app files

**File Structure:**
```
src/
├── bun/              # Main process
│   └── index.ts      # Entry point, window creation
└── main-ui/          # Renderer process
    ├── index.html    # HTML entry
    └── index.ts      # React app entry
```

**Main Process Example:**
```typescript
import { BrowserWindow, ApplicationMenu } from "electrobun/bun";

// Create window
const win = new BrowserWindow({
  title: "PingWrite",
  url: "views://main-ui/index.html",
  width: 1200,
  height: 800,
});

// Set up menus
ApplicationMenu.setApplicationMenu([
  {
    label: "File",
    submenu: [
      { label: "New", action: "file-new" },
      { label: "Open", action: "file-open" },
      { label: "Save", action: "file-save" },
    ],
  },
]);
```

**Renderer Process Example:**
```typescript
import { Electroview } from "electrobun/view";

const electrobun = new Electroview({ rpc: null });

// Listen for menu actions
electrobun.on("menu-action", (action) => {
  if (action === "file-save") {
    saveDocument();
  }
});

// Call main process
electrobun.rpc("saveFile", { content: "..." });
```

### 3. shadcn/ui

Component library with excellent TypeScript support and customization.

**Key Principles:**
- Components are copied to your project (not dependencies)
- Use `npx shadcn@latest add <component>` to add components
- Built on Radix UI primitives
- Styled with Tailwind CSS

**Critical Rules:**
- Use semantic colors: `bg-primary`, `text-muted-foreground`
- Use `cn()` for conditional classes
- Use `flex gap-*` instead of `space-y-*`
- Use `size-*` for equal dimensions
- Forms use `FieldGroup` + `Field` structure

**Components for PingWrite:**
- `Button` - Toolbar buttons
- `Tooltip` - Button hints
- `Dialog` - Settings, modals
- `DropdownMenu` - File menu, insert menu
- `Separator` - Dividers
- `ScrollArea` - Editor scrolling
- `Resizable` - Split panels

## Development Workflow

### 1. Adding Features

1. **Main Process Feature** (e.g., file operations):
   - Edit `src/bun/index.ts` or create new file in `src/bun/`
   - Use Electrobun APIs (BrowserWindow, ApplicationMenu, etc.)
   - Expose via RPC if needed by renderer

2. **Renderer Feature** (e.g., new UI component):
   - Create component in `src/renderer/components/`
   - Use shadcn/ui components where possible
   - Import and use in App.tsx or parent component

3. **Editor Feature** (e.g., new markdown syntax):
   - Add Milkdown plugin in `src/renderer/components/editor/`
   - Configure in editor setup
   - Update styles if needed

### 2. Styling Guidelines

**Tailwind + shadcn:**
```tsx
// ❌ Don't: Raw colors, manual ternaries
<div className={`p-4 ${isActive ? 'bg-blue-500' : 'bg-gray-100'}`}>

// ✅ Do: Semantic tokens, cn() utility
import { cn } from "@/lib/utils";
<div className={cn("p-4", isActive && "bg-primary")}>
```

**Editor Styling:**
- Milkdown is headless - we provide all CSS
- Use CSS variables for theming
- Support light/dark mode via `dark:` classes

### 3. State Management

**Local Component State:**
```typescript
const [content, setContent] = useState("");
```

**Editor State:**
- Managed by Milkdown/ProseMirror
- Access via `editor.action(ctx => ...)`

**IPC State:**
- Use Electrobun RPC for main <-> renderer communication
- Keep minimal state in main process

### 4. Engineering Principles (Normative)

These principles are mandatory. They are implementation constraints, not suggestions.

#### KISS

- Prefer straightforward control flow over meta-programming.
- Prefer explicit comptime branches and typed structs over hidden dynamic behavior.
- Keep error paths obvious and localized.

#### YAGNI

- Do not add config keys, vtable methods, or feature flags without a concrete caller.
- Do not introduce speculative abstractions.
- Keep unsupported paths explicit (`return error.NotSupported`) rather than silent no-ops.

#### DRY + Rule of Three

- Duplicate small local logic when it preserves clarity.
- Extract shared helpers only after repeated, stable patterns (rule-of-three).
- When extracting, preserve module boundaries and avoid hidden coupling.

#### Fail Fast + Explicit Errors

- Prefer explicit errors for unsupported or unsafe states.
- Never silently broaden permissions or capabilities.

#### Secure by Default + Least Privilege

- Deny-by-default for access and exposure boundaries.
- Never log secrets, raw tokens, or sensitive payloads.
- All outbound URLs must be HTTPS. HTTP is rejected at the tool layer.
- Keep network/filesystem/shell scope as narrow as possible.

#### Determinism + No Flaky Tests

- Tests must not spawn real network connections, open browsers, or depend on system state.
- Tests must be reproducible across macOS and Linux.

## Common Tasks

### Add a New Menu Item

1. Edit `src/bun/menu.ts`:
```typescript
{
  label: "View",
  submenu: [
    { label: "Toggle Sidebar", action: "view-toggle-sidebar" },
  ],
}
```

2. Handle in renderer `src/renderer/App.tsx`:
```typescript
electrobun.on("menu-action", (action) => {
  if (action === "view-toggle-sidebar") {
    setSidebarOpen(prev => !prev);
  }
});
```

### Add a Milkdown Plugin

1. Install: `bun add @milkdown/plugin-math`

2. Add to editor setup `src/renderer/components/editor/MilkdownEditor.tsx`:
```typescript
import { math } from "@milkdown/plugin-math";

Editor.make()
  .use(commonmark)
  .use(math)  // Add here
  .create();
```

3. Add CSS in `src/renderer/styles/milkdown.css`

### Add a shadcn Component

```bash
npx shadcn@latest add dialog
```

Then use in components:
```typescript
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
```

## File Organization

```
src/
├── main/                    # Main process (Bun/Electrobun)
│   ├── index.ts             # Entry point
│   ├── menu.ts              # Application menu definition
│   ├── window.ts            # Window management
│   ├── ipc/
│   │   ├── files.ts         # File operations IPC
│   │   └── system.ts        # System IPC
│   └── utils/
│       └── paths.ts         # Path utilities
│
├── renderer/                # Renderer process (React)
│   ├── components/
│   │   ├── editor/
│   │   │   ├── MilkdownEditor.tsx    # Main editor component
│   │   │   ├── useMilkdown.ts        # Editor hook
│   │   │   └── plugins/
│   │   │       └── custom/           # Custom plugins
│   │   │
│   │   ├── layout/
│   │   │   ├── RootLayout.tsx        # Main layout
│   │   │   ├── TitleBar.tsx          # Custom title bar
│   │   │   ├── Sidebar.tsx           # File explorer
│   │   │   ├── Toolbar.tsx           # Editor toolbar
│   │   │   └── StatusBar.tsx         # Bottom status bar
│   │   │
│   │   └── ui/              # shadcn/ui components
│   │       ├── button.tsx
│   │       ├── dialog.tsx
│   │       └── ...
│   │
│   ├── hooks/
│   │   ├── useFiles.ts      # File management hook
│   │   ├── useSettings.ts   # Settings hook
│   │   └── useTheme.ts      # Theme management
│   │
│   ├── lib/
│   │   ├── utils.ts         # Utility functions
│   │   └── electrobun.ts    # Electrobun view client
│   │
│   ├── styles/
│   │   ├── globals.css      # Global styles
│   │   ├── milkdown.css     # Milkdown editor styles
│   │   └── themes/
│   │       ├── light.css
│   │       └── dark.css
│   │
│   ├── App.tsx              # Main App component
│   └── index.html           # HTML entry
│
└── shared/                  # Shared between main and renderer
    ├── types/
    │   └── index.ts         # Shared TypeScript types
    └── constants/
        └── index.ts         # Shared constants
```

## Important Conventions

### Naming
- Components: PascalCase (`MilkdownEditor.tsx`)
- Hooks: camelCase with `use` prefix (`useFiles.ts`)
- Utils: camelCase (`formatDate.ts`)
- Styles: kebab-case (`milkdown-styles.css`)

### Imports
```typescript
// 1. External dependencies
import React from "react";
import { Editor } from "@milkdown/kit/core";

// 2. Internal absolute imports (@/ alias)
import { Button } from "@/components/ui/button";
import { useFiles } from "@/hooks/useFiles";

// 3. Relative imports
import { MilkdownEditor } from "./MilkdownEditor";
```

### Git Commits
```
feat: Add file explorer sidebar
fix: Fix auto-save not triggering on window blur
docs: Update README with build instructions
style: Fix toolbar button alignment
refactor: Extract file operations to separate module
test: Add tests for file saving
```

## Debugging

### Main Process
```bash
# Logs appear in terminal where you run `bun dev`
bun dev
```

### Renderer Process
```bash
# Enable DevTools in Electrobun
# Add to BrowserWindow options:
const win = new BrowserWindow({
  // ...
  webPreferences: {
    devTools: true,
  },
});
```

### Milkdown
Enable inspector:
```typescript
const editor = Editor.make()
  .use(commonmark)
  .enableInspector()  // Add this
  .create();
```

## Resources

- [Milkdown Docs](https://milkdown.dev/docs)
- [Milkdown API Reference](https://milkdown.dev/docs/api-reference)
- [Electrobun Docs](https://blackboard.sh/electrobun/docs/)
- [shadcn/ui Docs](https://ui.shadcn.com/docs)
- [ProseMirror Guide](https://prosemirror.net/docs/guide/)

## Questions?

Check the project documentation:
- `README.md` - User-facing documentation
- `doc/architecture.md` - Detailed architecture
- `findings.md` - Research notes

Or open an issue on GitHub.
