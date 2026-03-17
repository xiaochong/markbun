# AGENTS.md - MarkBun Development Guide

## Project Overview

**MarkBun** is a Typora-like markdown desktop editor built with:
- **Milkdown**: WYSIWYG markdown editor framework
- **Electrobun**: Bun + WebView cross-platform desktop framework  
- **shadcn/ui**: React component library
- **TypeScript**: Type-safe development

## Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────────┐
│                      MarkBun Application                         │
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

**Usage Pattern for MarkBun:**
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
  title: "MarkBun",
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

**Components for MarkBun:**
- `Button` - Toolbar buttons
- `Tooltip` - Button hints
- `Dialog` - Settings, modals
- `DropdownMenu` - File menu, insert menu
- `Separator` - Dividers
- `ScrollArea` - Editor scrolling
- `Resizable` - Split panels

## Development Workflow

### 0. Pre-commit Checks (MANDATORY)

Before committing any code changes, you MUST run these checks:

```bash
# Quick syntax and type check
bun run typecheck

# Full check (types + tests)
bun run lint
```

**Commands:**
- `bun run typecheck` - TypeScript type checking (`tsc --noEmit`)
- `bun run lint` - Full validation: type check + run tests
- `bun test` - Run unit tests only

**What to check:**
- ✓ `bun run typecheck` - Should show "No errors in src directory"
- ✓ `bun run lint` - All tests should pass
- ⚠️ Node_modules type errors can be ignored (from electrobun dependency)

**Failure handling:**
- If `typecheck` shows errors in `src/` directory: Fix them before proceeding
- If `bun test` fails: Fix errors and re-run
- Never commit code that doesn't pass `bun run lint`

**Manual verification:**
```bash
# Only check our code, ignore node_modules
bun run typecheck 2>&1 | grep "src/" || echo "✓ No errors in src"

# Just run tests
bun test
```

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

## Testing Guidelines

### Test Framework

MarkBun uses **Bun's built-in test runner** for all unit tests.

**Run Tests:**
```bash
bun test              # Run all tests once
bun run test          # Same as above
bun run test:watch    # Run tests in watch mode
bun run test:coverage # Run tests with coverage report
```

### Test File Organization

Tests are located in a separate `tests/` directory, mirroring the `src/` structure:

```
tests/
├── unit/
│   ├── setup.ts                           # Test helper - simplified imports
│   └── components/
│       └── editor/
│           ├── index.test.ts              # Test suite entry
│           ├── types.test.ts              # Type definition tests
│           ├── utils/
│           │   ├── tableHelpers.test.ts   # Table utility tests
│           │   └── editorActions.test.ts  # Editor action tests
│           ├── hooks/
│           │   └── index.test.ts          # Hooks tests
│           └── commands/
│               ├── formatting.test.ts     # Formatting command tests
│               ├── paragraph.test.ts      # Paragraph command tests
│               └── table.test.ts          # Table command tests
├── integration/                           # Integration tests (future)
└── e2e/                                   # E2E tests (future)
```

**Simplified Imports via `setup.ts`:**

Instead of using long relative paths like `../../../../../src/...`, import from `setup.ts`:

```typescript
// ✅ 推荐: 从 setup.ts 导入 (简洁)
import { isTableCell, toggleBold, insertTable } from '../setup';

// ❌ 避免: 长相对路径 (繁琐)
import { isTableCell } from '../../../../../src/mainview/components/editor/utils/tableHelpers';
```

**`setup.ts` 提供以下导出:**
- Utils: `isTableCell`, `findTableNode`, `execCommand`, `hasSelection`, etc.
- Commands: `toggleBold`, `toggleItalic`, `insertTable`, `deleteTable`, etc.
- Types: `MilkdownEditorProps`, `TableCellInfo`, etc.

**注意:** Hooks 需要 DOM 环境，不在 `setup.ts` 中导出。如需测试 hooks，请在浏览器环境中直接导入。

### Writing Tests

**Test Naming Convention:**
- File: `*.test.ts` (Bun convention)
- Describe block: Module or function name
- Test case: `should [expected behavior] when [condition]`

**Example:**
```typescript
import { describe, it, expect, mock } from 'bun:test';
import { isTableCell } from '../utils/tableHelpers';

describe('isTableCell', () => {
  it('should return true for table_cell node', () => {
    const node = { type: { name: 'table_cell' } };
    expect(isTableCell(node)).toBe(true);
  });

  it('should return false for paragraph node', () => {
    const node = { type: { name: 'paragraph' } };
    expect(isTableCell(node)).toBe(false);
  });
});
```

### Testing Patterns

**1. Testing Editor Commands:**
```typescript
// Always test null/undefined editor reference first
it('should return false when editor is not initialized', () => {
  const emptyRef = { current: null };
  expect(toggleBold(emptyRef as any)).toBe(false);
});

// Test successful execution
it('should call editor action when initialized', () => {
  const ref = createMockCrepeRef();
  expect(toggleBold(ref as any)).toBe(true);
});
```

**2. Testing Hooks:**
```typescript
// Test hook is defined and exported
describe('useCrepeEditor', () => {
  it('should be defined', () => {
    const { useCrepeEditor } = require('../../hooks/useCrepeEditor');
    expect(typeof useCrepeEditor).toBe('function');
  });
});
```

**3. Testing Utilities:**
```typescript
// Test edge cases
it('should handle empty document', () => {
  const state = createMockState({ selection: { from: 0 } });
  expect(findTableNode(state)).toBeNull();
});
```

### Test Coverage Requirements

**Minimum Coverage:**
- Utils: 90%+
- Commands: 80%+
- Hooks: 70%+
- Types: Type checking tests

**Coverage Report:**
```bash
bun test --coverage
```

### Mocking Guidelines

**Use `mock()` from `bun:test`:**
```typescript
import { mock } from 'bun:test';

const mockFn = mock(() => true);
expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledTimes(1);
```

**Mock External Dependencies:**
```typescript
// Mock CSS imports
const mockCssImport = mock(() => ({
  default: 'mocked-css-content',
}));
```

### Pre-commit Testing

Before committing changes to editor module:

```bash
# Quick check - type checking only
bun run typecheck

# Full check - types + tests (REQUIRED before commit)
bun run lint

# Or run individually:
# 1. Run type checking
bunx tsc --noEmit

# 2. Run all tests
bun test

# 3. Run tests with coverage
bun test --coverage
```

### When to Write Tests

**Required:**
- New utility functions
- New editor commands
- Changes to table operations
- Changes to markdown parsing

**Recommended:**
- New hooks
- Refactored code
- Bug fixes (regression tests)

**Not Required:**
- Type-only changes
- Documentation updates
- Style changes (CSS)

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

### Automation with agent-browser

Load the `agent-browser` skill for browser automation testing and debugging. **Always use `--cdp 9222`**:

```shell
# Connect to the running Chrome with remote debugging on port 9222
agent-browser --cdp 9222 open http://localhost:5173
agent-browser --cdp 9222 snapshot
```

Example commands:
```bash
agent-browser --cdp 9222 snapshot -i       # Get interactive elements snapshot
agent-browser --cdp 9222 click @e1         # Click element
agent-browser --cdp 9222 screenshot        # Take screenshot
```

## Image Handling Best Practices

### CRITICAL: Always Use Blob URLs for Display

**Never embed base64 images directly in the editor.** This causes severe performance issues with large images.

#### The Pattern

```
Storage:     File System (original image)
              ↓
Loading:     Bun process reads → base64 → Blob URL
              ↓
Display:     Markdown uses Blob URL ( performant )
              ↓
Saving:      Blob URL → original path (via cache mapping)
```

#### Implementation Flow

**1. Loading Images (Bun Process)**
```typescript
// src/bun/index.ts - readImageAsBase64
const imageBuffer = await readFile(path);
const base64 = imageBuffer.toString('base64');
return { success: true, dataUrl: `data:${mimeType};base64,${base64}` };
```

**2. Converting to Blob URL (Renderer)**
```typescript
// src/mainview/lib/image/cache.ts - ImageCache
function dataUrlToBlobUrl(dataUrl: string): string {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  const mimeType = match[1];
  const base64Data = match[2];

  // Convert base64 to binary
  const byteCharacters = atob(base64Data);
  const byteArrays: BlobPart[] = [];

  // Process in chunks to avoid stack overflow with large images
  const chunkSize = 8192;
  for (let offset = 0; offset < byteCharacters.length; offset += chunkSize) {
    const chunk = byteCharacters.slice(offset, offset + chunkSize);
    const byteNumbers = new Array(chunk.length);
    for (let i = 0; i < chunk.length; i++) {
      byteNumbers[i] = chunk.charCodeAt(i);
    }
    byteArrays.push(new Uint8Array(byteNumbers));
  }

  const blob = new Blob(byteArrays, { type: mimeType });
  return URL.createObjectURL(blob);
}
```

**3. Display in Editor**
```typescript
// Editor markdown uses blob URL
const markdown = `![alt](blob:https://...)`;
```

**4. Restore Original Path on Save**
```typescript
// src/mainview/lib/image/clipboard.ts - prepareForClipboard
export function prepareForClipboard(markdown: string): string {
  return markdown.replace(IMAGE_REGEX, (match, alt, url) => {
    if (isBlobUrl(url)) {
      const originalPath = imageCache.getOriginalPath(url);
      if (originalPath) {
        return `![${alt}](${originalPath})`;
      }
    }
    return match;
  });
}
```

#### Why Blob URLs?

| Approach | Pros | Cons |
|---------|------|------|
| **Blob URL** ✅ | Fast rendering, low memory, cached | Requires cache management |
| **Base64 in Markdown** ❌ | Self-contained | Slow rendering, huge memory, laggy UI |
| **File Path Directly** ❌ | Simple | WebView cannot access local files (security) |

#### Key Rules

1. **WebView Limitation**: WebView cannot access `file://` paths directly → must use blob/data URLs
2. **Performance**: Base64 in markdown bloats document size and slows rendering
3. **Cache Management**: Use LRU cache with `URL.revokeObjectURL()` to prevent memory leaks
4. **Path Mapping**: Always maintain `blobUrl <-> originalPath` mapping for save/export

#### Drag-Drop Implementation

When implementing drag-drop image insertion:

1. Read file as base64 (FileReader)
2. Check if file already exists in workspace (recursive, max 3 levels)
   - Compare: filename + file size + first/last 10 bytes
   - If found → use existing file's relative path
   - If not found → save to `assets/` directory
3. Load through `loadLocalImage()` → returns blob URL
4. Insert markdown with blob URL
5. On save, blob URLs automatically convert to relative paths

```typescript
// Correct flow
const dataUrl = await readFileAsDataURL(file);
const base64 = extractBase64FromDataUrl(dataUrl);
const saveResult = await electrobun.saveDroppedImage(fileName, base64, workspaceRoot);
// Bun process will:
// - Search recursively (max 3 levels) for existing file
// - Compare: name + size + head(10bytes) + tail(10bytes)
// - Return existing path if found, or save to assets/
const blobUrl = await loadLocalImage(saveResult.absolutePath); // ✅ Use blob URL
editor.insertImage(blobUrl, alt); // ✅ Not base64!
```

**Duplicate Detection Logic:**
- **Step 1**: Search workspace recursively (max depth: 3)
- **Step 2**: Skip hidden dirs (`.git`, `node_modules`, `.cache`, `dist`, `build`)
- **Step 3**: For files with matching name:
  - Compare file size
  - Compare first 10 bytes (file header/signature)
  - Compare last 10 bytes (unique content)
- **Step 4**: If all match → use existing file, don't copy
- **Step 5**: If not found → save to `assets/<filename>`

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
