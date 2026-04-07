---
title: "feat: Mermaid diagram viewer with zoom and pan"
type: feat
status: active
date: 2026-04-07
origin: docs/brainstorms/2026-04-07-mermaid-zoom-pan-requirements.md
---

# feat: Mermaid diagram viewer with zoom and pan

## Overview

Add a modal viewer that allows users to zoom and pan large Mermaid diagrams. Triggered via right-click context menu on Mermaid blocks in the editor. The modal renders the diagram at full quality and supports mouse wheel zoom, button zoom, drag panning, and keyboard shortcuts.

## Problem Frame

Large Mermaid diagrams are squeezed to fit the editor width, making text illegible. Users need a way to view diagrams at full resolution and navigate them freely. (see origin: `docs/brainstorms/2026-04-07-mermaid-zoom-pan-requirements.md`)

## Requirements Trace

- R1. Right-click on Mermaid preview shows context menu with "View Diagram" option
- R2. Default context menu items remain available alongside "View Diagram"
- R3. "View Diagram" only appears for Mermaid blocks, not other content
- R4. Modal overlay with semi-transparent backdrop
- R5. Full-quality SVG rendering (re-rendered, not reused from inline)
- R6. Close button + Escape key + backdrop click to dismiss
- R7. Mouse wheel zoom centered on cursor
- R8. Toolbar with +/- buttons, percentage display, reset button
- R9. Click-and-drag panning when diagram exceeds viewport
- R10. Zoom range 10%–500%
- R11. Cursor changes (grab/grabbing) when panning available
- R12. Fit-to-view initial display
- R13. Loading indicator during rendering
- R14. Error message on rendering failure
- R15. Keyboard shortcuts: +/-/= for zoom, 0 for reset, arrow keys for pan

## Scope Boundaries

- No zoom/pan in the inline editor preview — modal only
- No editing in the modal — view-only
- No separate native window — modal overlay only
- No LaTeX or HTML preview block support in this iteration

## Context & Research

### Relevant Code and Patterns

- **Dialog pattern**: All dialogs use `isOpen`/`onClose` props, `z-50`, `bg-black/50` backdrop, `e.target === e.currentTarget` for click-outside. Reference: `src/mainview/components/settings/SettingsDialog.tsx`
- **Zoom/pan pattern**: `src/mainview/components/image-viewer/ImageViewer.tsx` — CSS `transform: translate() scale()` with `onWheel`, `onMouseDown/Move/Up` events. Zoom range 0.1–5.0
- **Context menu system**: `src/mainview/components/editor/hooks/useContextMenu.ts` + `src/bun/index.ts` lines 580–656. Uses Electrobun native `ContextMenu.showContextMenu()`, dispatches via `ContextMenu.on('context-menu-clicked', ...)`
- **Mermaid rendering**: `src/mainview/components/editor/hooks/useCrepeEditor.ts` lines 211–271. Dynamic `import('mermaid')`, `mermaid.render(id, code)`, returns SVG string
- **State management**: App.tsx uses simple `useState` for all dialog state. Dialogs rendered as siblings at bottom of JSX
- **Window globals pattern**: `window.__pendingEditorSelection`, `window.__pendingTableCellText` — store data before native menu opens
- **i18n**: 8 locales in `src/shared/i18n/locales/{lang}/{namespace}.json`. Editor namespace has `imageViewer.*` keys to mirror

### Institutional Learnings

- Context menu actions must register in both `actionToEvent` mapping (Windows/Linux) AND `ApplicationMenu.on('application-menu-clicked', ...)` switch-case (macOS)
- Cross-platform menu checklist from `docs/solutions/ui-bugs/macos-menu-action-dispatch-bug-2026-04-03.md`

## Key Technical Decisions

- **DOM-based Mermaid detection**: Check `target.closest('.milkdown-code-block[data-lang="mermaid"]')` in the context menu handler. Simpler and more reliable than ProseMirror node traversal, consistent with the existing click-to-edit handler pattern in `useCrepeEditor.ts`
- **ProseMirror source extraction**: After DOM detection, use `view.posAtCoords()` → `doc.resolve(pos)` → find `code_block` parent node → `node.textContent` to extract raw Mermaid source. This is the same pattern used for table cell text extraction
- **Re-render in modal**: Pass raw Mermaid source to the modal component and call `mermaid.render()` there. Ensures full quality and proper theme handling. Loading state covers the brief delay (R13)
- **Window global for cross-process communication**: Store Mermaid source in `window.__pendingMermaidSource` before showing native context menu (same pattern as `__pendingEditorSelection`). Main process fires JS back to read this global when "View Diagram" is clicked
- **CSS transform for zoom/pan**: Follow ImageViewer's `transform: translate() scale()` approach. Works well with SVG content and avoids layout recalculation
- **Fit-to-view calculation**: On mount, read the SVG's natural dimensions (via `getBBox()` or `viewBox`), compute scale to fit within the modal viewport, and set as initial zoom

## Open Questions

### Resolved During Planning

- **Mermaid block detection method**: DOM inspection `[data-lang="mermaid"]` + ProseMirror source extraction (simplest, follows existing patterns)
- **Content passing to modal**: Raw Mermaid source, re-rendered in modal (per requirements R5)
- **Modal sizing**: Follow existing dialog pattern but larger — use `w-[90vw] h-[85vh]` for near-fullscreen diagram viewing

### Deferred to Implementation

- **ProseMirror code_block node type name**: Verify the exact node type name in Milkdown's schema (likely `code_block` or `fence`). Check at implementation time by inspecting `view.state.doc.resolve(pos).node(d).type.name`
- **SVG dimension extraction**: Whether to use `getBBox()`, `viewBox` attribute, or `getBoundingClientRect()` for fit-to-view calculation — depends on how Mermaid generates SVGs

## Implementation Units

- [ ] **Unit 1: MermaidDiagramViewer component**

**Goal:** Create the self-contained modal component that renders a Mermaid SVG diagram with full zoom/pan controls, loading/error states, and keyboard shortcuts.

**Requirements:** R4, R5, R6, R7, R8, R9, R10, R11, R12, R13, R14, R15

**Dependencies:** None

**Files:**
- Create: `src/mainview/components/mermaid-viewer/MermaidDiagramViewer.tsx`
- Create: `src/mainview/components/mermaid-viewer/index.ts`

**Approach:**
- Props: `isOpen: boolean`, `onClose: () => void`, `mermaidSource: string | null`
- Component structure: backdrop overlay → inner panel (toolbar + diagram container)
- Rendering: Dynamic `import('mermaid')` → `mermaid.render()` on mount and when `mermaidSource` changes. Store SVG string in state, render via `dangerouslySetInnerHTML` in a container div
- Zoom state: `zoom` (number, initial = fit-to-view calculated value), `position` ({x, y})
- Fit-to-view: On render completion, measure SVG natural dimensions, calculate scale to fit within viewport, set as initial `zoom`
- Panning condition: Enable drag when SVG rendered size exceeds container (not just zoom > 100%)
- Keyboard: `onKeyDown` handler with `+`/`=`/`-`/`0`/Arrow keys. Requires `tabIndex={0}` and auto-focus on open
- Dark mode: Use `document.documentElement.classList.contains('dark')` or pass as prop for Mermaid theme
- Close: Close button in toolbar, Escape key, backdrop click (`e.target === e.currentTarget`)
- Loading state: Disable zoom/pan controls (toolbar buttons and keyboard shortcuts) while Mermaid is rendering. Show spinner with "Rendering diagram..." text

**Patterns to follow:**
- Backdrop/dialog structure: `src/mainview/components/settings/SettingsDialog.tsx`
- Zoom/pan interaction: `src/mainview/components/image-viewer/ImageViewer.tsx`
- Mermaid rendering: `src/mainview/components/editor/hooks/useCrepeEditor.ts` lines 211–271

**Test scenarios:**
- Happy path: component renders SVG, zoom in/out via wheel, pan via drag, reset button works
- Edge case: very large SVG (5000×3000) fits to view correctly on initial load
- Edge case: very small SVG (100×50) does not zoom beyond container
- Error path: invalid Mermaid syntax shows error state with close option
- Error path: Mermaid import fails shows generic error
- Keyboard: +/- keys zoom, 0 resets, arrow keys pan, Escape closes
- Close: backdrop click, close button, Escape all dismiss the modal

**Verification:**
- Component renders a Mermaid diagram with working zoom/pan
- Loading spinner shows during render, error state shows on failure
- All close methods work (button, Escape, backdrop click)
- Fit-to-view initial display works for various diagram sizes

---

- [ ] **Unit 2: Context menu detection and RPC integration**

**Goal:** Detect right-click on Mermaid blocks, show Mermaid-specific context menu with "View Diagram" option, handle the action to open the viewer.

**Requirements:** R1, R2, R3

**Dependencies:** None (can be developed in parallel with Unit 1, wired together in Unit 3)

**Files:**
- Modify: `src/mainview/components/editor/hooks/useContextMenu.ts`
- Modify: `src/mainview/lib/electrobun.ts`
- Modify: `src/shared/types.ts`
- Modify: `src/bun/index.ts`

**Approach:**

**useContextMenu.ts changes:**
- After confirming click is in `.ProseMirror`, add Mermaid block detection before the table check
- DOM detection: `target.closest('.milkdown-code-block[data-lang="mermaid"]')`
- If Mermaid block found: use ProseMirror to extract source code from the code block node at the click position, store in `window.__pendingMermaidSource`. Wrap extraction in try-catch — fall back to `showDefaultContextMenu()` if ProseMirror node resolution fails
- Call `electrobun.showMermaidContextMenu()` instead of `showDefaultContextMenu()`

**RPC additions:**
- Add `showMermaidContextMenu` RPC in `types.ts` and `electrobun.ts` (same pattern as existing context menu RPCs)

**Main process (index.ts):**
- Add `showMermaidContextMenu` handler: build menu with standard items (undo, redo, cut, copy, paste, separator, insert table, separator, format submenu) PLUS a new "View Diagram" item at the top with action `mermaid-view-diagram`
- Add `mermaid-view-diagram` case to `ContextMenu.on('context-menu-clicked', ...)` handler: fire JS to WebView that calls `window.__openMermaidViewer(window.__pendingMermaidSource)` and clears `window.__pendingMermaidSource`

**i18n:** Add `paragraph.viewDiagram` key to all 8 locale `menu.json` files

**Patterns to follow:**
- RPC pattern: `src/shared/types.ts` `MarkBunRPC.bun.requests` → `src/mainview/lib/electrobun.ts` client method → `src/bun/index.ts` handler
- Context menu structure: `src/bun/index.ts` lines 622–656 (`showDefaultContextMenu`)
- Window globals: `window.__pendingEditorSelection` pattern in `useContextMenu.ts`

**Test scenarios:**
- Happy path: right-click Mermaid block shows context menu with "View Diagram" + standard items
- Edge case: right-click outside Mermaid block shows default context menu (no "View Diagram")
- Edge case: right-click Mermaid block in selected/editing state — behavior should match non-selected
- Integration: clicking "View Diagram" fires JS that reaches `window.__openMermaidViewer` with correct source

**Verification:**
- Right-clicking a Mermaid diagram shows a context menu with "View Diagram"
- Right-clicking other editor content shows the standard menu without "View Diagram"
- Clicking "View Diagram" triggers the viewer open callback with Mermaid source

---

- [ ] **Unit 3: App.tsx wiring and i18n completion**

**Goal:** Wire the MermaidDiagramViewer component into App.tsx, set up the cross-process communication bridge, and complete all i18n translations.

**Requirements:** All (integration)

**Dependencies:** Unit 1, Unit 2

**Files:**
- Modify: `src/mainview/App.tsx`
- Modify: `src/shared/i18n/locales/en/editor.json`
- Modify: `src/shared/i18n/locales/zh-CN/editor.json`
- Modify: `src/shared/i18n/locales/de/editor.json`
- Modify: `src/shared/i18n/locales/fr/editor.json`
- Modify: `src/shared/i18n/locales/ja/editor.json`
- Modify: `src/shared/i18n/locales/ko/editor.json`
- Modify: `src/shared/i18n/locales/pt/editor.json`
- Modify: `src/shared/i18n/locales/es/editor.json`
- Modify: `src/shared/i18n/locales/en/menu.json`
- Modify: `src/shared/i18n/locales/zh-CN/menu.json`
- Modify: `src/shared/i18n/locales/de/menu.json`
- Modify: `src/shared/i18n/locales/fr/menu.json`
- Modify: `src/shared/i18n/locales/ja/menu.json`
- Modify: `src/shared/i18n/locales/ko/menu.json`
- Modify: `src/shared/i18n/locales/pt/menu.json`
- Modify: `src/shared/i18n/locales/es/menu.json`

**Approach:**

**App.tsx:**
- Add state: `const [mermaidViewerSource, setMermaidViewerSource] = useState<string | null>(null)`
- Set up `window.__openMermaidViewer` in a `useEffect`: assigns a function that calls `setMermaidViewerSource(source)`
- Add cleanup: when `mermaidViewerSource` is set to null, clear `window.__pendingMermaidSource`
- Render `<MermaidDiagramViewer>` alongside other dialogs at bottom of JSX:
  ```
  <MermaidDiagramViewer
    isOpen={mermaidViewerSource !== null}
    onClose={() => setMermaidViewerSource(null)}
    mermaidSource={mermaidViewerSource}
  />
  ```

**i18n additions:**

editor.json — add keys:
- `mermaidViewer.zoomIn`: "Zoom In"
- `mermaidViewer.zoomOut`: "Zoom Out"
- `mermaidViewer.reset`: "Reset"
- `mermaidViewer.rendering`: "Rendering diagram..."
- `mermaidViewer.renderError`: "Failed to render diagram"
- `mermaidViewer.close`: "Close"

menu.json — add key:
- `paragraph.viewDiagram`: "View Diagram"

All 8 locales updated with translations.

**Patterns to follow:**
- Dialog state: existing `useState` pattern in App.tsx for `showSettingsDialog`, `imagePreviewPath`, etc.
- Window global setup: `window.__markbunAI` pattern in `src/mainview/lib/ai-tools.ts`
- i18n key naming: follow `imageViewer.*` pattern in `editor.json`

**Test scenarios:**
- Integration: right-click Mermaid → "View Diagram" → modal opens with correct diagram
- Integration: close modal → state resets → can reopen another diagram
- Integration: switch files while modal is open — modal should close or show current file's diagram
- i18n: all 8 locales have correct keys and no missing translations

**Verification:**
- Full end-to-end flow works: right-click → View Diagram → modal with zoom/pan → close
- All 8 locales have the new translation keys
- Dark mode renders correctly in the viewer

## System-Wide Impact

- **Interaction graph:** Context menu handler in `useContextMenu.ts` gains a new detection branch. Main process gains a new context menu variant and action handler. App.tsx gains new dialog state.
- **Error propagation:** Mermaid render errors are caught and displayed in the modal. No errors propagate to the main process.
- **State lifecycle risks:** `window.__pendingMermaidSource` must be cleared after use to prevent stale data. If the modal is opened and the editor document changes, the source should still be valid since it's a snapshot.
- **Unchanged invariants:** Inline Mermaid preview behavior is unchanged. Default context menu for non-Mermaid content is unchanged. Other dialogs are unaffected.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| ProseMirror code_block node type name differs from expected | Verify at implementation time via `doc.resolve(pos).node(d).type.name` inspection |
| SVG dimension extraction for fit-to-view | Test with multiple diagram types (sequence, flowchart, class). Use `getBBox()` as primary, `viewBox` as fallback |
| Mermaid re-render latency for complex diagrams | Loading spinner (R13) covers this. Mermaid rendering is typically <500ms |
| Context menu item ordering — "View Diagram" placement | Place at top of menu before edit actions for visibility |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-07-mermaid-zoom-pan-requirements.md](docs/brainstorms/2026-04-07-mermaid-zoom-pan-requirements.md)
- Dialog pattern: `src/mainview/components/settings/SettingsDialog.tsx`
- Zoom/pan pattern: `src/mainview/components/image-viewer/ImageViewer.tsx`
- Context menu: `src/mainview/components/editor/hooks/useContextMenu.ts`, `src/bun/index.ts`
- Mermaid rendering: `src/mainview/components/editor/hooks/useCrepeEditor.ts`
- Cross-platform menu checklist: `docs/solutions/ui-bugs/macos-menu-action-dispatch-bug-2026-04-03.md`
