---
title: "feat: Clipboard Operations Refactor — ProseMirror Native Copy/Cut, IPC Paste with HTML Conversion"
date: 2026-04-04
status: active
origin: docs/brainstorms/2026-04-04-clipboard-operations-requirements.md
depth: standard
---

# Clipboard Operations Refactor

## Problem Frame

MarkBun's clipboard operations are broken at the architecture level. A global `capture:true` keyboard handler in `App.tsx` intercepts Cmd+C/V/X before ProseMirror, routing everything through IPC (pbcopy/pbpaste). This kills ProseMirror's HTML clipboard, slice depth preservation, and transaction consistency. The `clipboardBlobConverter` plugin's `clipboardTextSerializer` is registered but never triggered by keyboard events because they're consumed before reaching ProseMirror.

**Verified constraints**:
1. In Electrobun's WebView, `copy`/`cut` events fire normally but `paste` events do NOT fire (WebView natively inserts text/plain without JS involvement). This dictates a hybrid approach: copy/cut via ProseMirror native, paste via IPC.
2. Electrobun's native menu registers `CmdOrCtrl+C/X/V` as accelerators in `src/bun/menu.ts` (lines 92-94). These fire at the OS level BEFORE the WebView receives keydown events. On macOS, Cmd+C/X/V is consumed by `application-menu-clicked` → `menuAction` RPC, never reaching the WebView's keyboard handler. This means the keyboard handler's `case 'c':` / `case 'x':` / `case 'v':` branches only execute for INPUT/TEXTAREA targets or when the menu system doesn't intercept (e.g., Cmd+Shift+V).

Origin document: `docs/brainstorms/2026-04-04-clipboard-operations-requirements.md`

## Requirements Trace

| Req | Description | Plan Unit |
|-----|-------------|-----------|
| R1 | Cmd+C via ProseMirror native copy event | Unit 1, 2 |
| R2 | Cmd+X via ProseMirror native cut event | Unit 1, 2 |
| R3 | clipboardTextSerializer: blob URL → original path | Unit 1 (existing code) |
| R4 | clipboardTextSerializer: yaml code block → frontmatter | Unit 1 |
| R5 | Cmd+V via App.tsx interception + IPC | Unit 2, 3 |
| R6 | readFromClipboard returns text + html | Unit 3 |
| R7 | Paste: HTML → turndown → markdown → Milkdown parser | Unit 4 |
| R8 | Paste: local image paths → blob URL | Unit 4 (existing processFromClipboard) |
| R9 | Cmd+Shift+V plain text paste | Unit 4 |
| R10 | Clipboard image detection → save → insert | Unit 5 |
| R11 | Source mode: no changes (WebView native) | Unit 2 (preserve) |
| R12 | INPUT/TEXTAREA: IPC path unchanged | Unit 2 (preserve) |

## Scope Boundaries

- **In**: Copy/cut via ProseMirror, paste via IPC + turndown, image paste, frontmatter fix
- **Out**: Clipboard history, AI-driven paste, configurable paste modes, LaTeX clipboard handling
- **HTML conversion**: best-effort via turndown; complex nested tables/CSS may not convert perfectly

## High-Level Design

```
Copy (Cmd+C) — keyboard never reaches WebView          Paste (Cmd+V) — same: menu intercepts
┌──────────────────────────────────────────┐           ┌──────────────────────────────────────┐
│ macOS native menu fires                   │           │ macOS native menu fires               │
│ → application-menu-clicked                │           │ → application-menu-clicked            │
│ → menuAction RPC → App.tsx                │           │ → menuAction RPC → App.tsx            │
│ → editor.focus() + document.execCommand   │           │ → clipboard.paste(false)              │
│   ('copy')                                │           │ → IPC readFromClipboard({             │
│ → ProseMirror ClipboardEvent fires        │           │     html: true, image: true })        │
│ → DataTransfer:                           │           │ → has image? save & insert            │
│   text/html (DOMSerializer)               │           │ → is self-copy? use text/plain        │
│   text/plain (clipboardTextSerializer)    │           │ → has html? turndown → markdown       │
│     → blob URL → path                     │           │ → else: text as markdown              │
│     → yaml code block → frontmatter       │           │ → insertMarkdown() at cursor          │
└──────────────────────────────────────────┘           └──────────────────────────────────────┘

Paste (Cmd+Shift+V) — menu does NOT register this shortcut, reaches keyboard handler
┌──────────────────────────────────────┐
│ Keyboard handler case 'v' + shiftKey │
│ → clipboard.paste(true)              │
│ → IPC readFromClipboard()            │
│ → insert text as-is (no turndown)    │
└──────────────────────────────────────┘
```

**Key architectural insight**: On macOS, Cmd+C/X/V is consumed by the native menu accelerator BEFORE reaching the WebView. All copy/cut/paste logic for these shortcuts routes through the `menuAction` handler in App.tsx, NOT the keyboard handler. The keyboard handler's copy/cut branches are effectively only for INPUT/TEXTAREA targets. Cmd+Shift+V is NOT registered as a menu accelerator, so it reaches the keyboard handler normally.

## Implementation Units

### Unit 1: Extract frontmatter conversion + enhance clipboardBlobConverter

**Goal**: Make `clipboardTextSerializer` output correct markdown with frontmatter conversion and blob URL resolution (R3, R4).

**Files**:
- [ ] `src/mainview/lib/frontmatter.ts` — NEW: extract shared conversion functions
- [ ] `src/mainview/components/editor/plugins/clipboardBlobConverter.ts` — add frontmatter conversion
- [ ] `src/mainview/components/editor/hooks/useCrepeEditor.ts` — import from shared module instead of local functions

**Changes**:

1. Create `src/mainview/lib/frontmatter.ts` with the two conversion functions currently private in `useCrepeEditor.ts` (lines 33-61):
   - `convertFrontmatterToCodeBlock(markdown: string): string`
   - `convertCodeBlockToFrontmatter(markdown: string): string`
   - Export both as named exports

2. In `clipboardBlobConverter.ts`, after `prepareForClipboard(markdown)` call (line 33), add `convertCodeBlockToFrontmatter()`:
   ```
   let markdown = serializer(doc);
   markdown = prepareForClipboard(markdown);
   markdown = convertCodeBlockToFrontmatter(markdown);
   return markdown;
   ```

3. Update `useCrepeEditor.ts` to import from `@/lib/frontmatter` instead of defining locally. Remove the two local functions.

**Why this order**: The frontmatter conversion functions are currently duplicated-risk — they're private in `useCrepeEditor.ts` but needed in `clipboardBlobConverter.ts`. Extraction makes them shareable without changing any behavior.

**Pattern reference**: `docs/solutions/best-practices/milkdown-frontmatter-display-workaround-2026-04-04.md` documents the bidirectional pattern and the `^` anchor requirement.

**Test scenarios**:
- Copy full document with frontmatter → clipboard contains `---\n...\n---` not `` ```yaml ``
- Copy partial selection from yaml code block area → NOT converted (regex `^` anchor prevents it — `^` matches start of serialized string, which is the start of the selection)
- Copy content with blob URLs → clipboard contains original file paths
- Copy content without frontmatter or blob URLs → unchanged

### Unit 2: Reroute menu action handler for copy/cut via ProseMirror + finalize keyboard handler

**Goal**: Reroute the `editor-copy`/`editor-cut` menu actions to trigger ProseMirror's native clipboard events, keep paste via IPC, clean up keyboard handler (R1, R2, R5, R11, R12).

**Files**:
- [ ] `src/mainview/App.tsx` — update menu action handler for copy/cut (lines 1226-1244)
- [ ] `src/mainview/App.tsx` — clean up keyboard handler (lines 1406-1451)

**Changes**:

1. **Menu action handler** (lines 1226-1244) — the PRIMARY path for Cmd+C/X/V on macOS:

   ```typescript
   case 'editor-copy': {
     if (sourceModeRef.current) break; // Source mode: WebView native
     editorRef.current?.focus();       // Ensure ProseMirror has focus
     document.execCommand('copy');     // Triggers ProseMirror ClipboardEvent
     break;
   }
   case 'editor-cut': {
     if (sourceModeRef.current) break;
     editorRef.current?.focus();
     document.execCommand('cut');
     break;
   }
   case 'editor-paste': {
     if (sourceModeRef.current) break;
     void clipboard.paste(false);      // IPC paste (paste events don't fire in WebView)
     break;
   }
   ```

   **Critical**: `editorRef.current?.focus()` must be called before `document.execCommand('copy'/'cut')` because the RPC callback context may not have the ProseMirror element focused. Without focus, the synthetic copy event fires on whatever has focus (likely `document.body`), bypassing ProseMirror's handler entirely.

2. **Keyboard handler** (lines 1406-1451): Remove `[CLIPBOARD-TEST]` comments. On macOS, the `case 'c':` / `case 'x':` / `case 'v':` branches only execute for INPUT/TEXTAREA targets (the native menu consumes keyboard events for the editor). Keep only INPUT/TEXTAREA IPC paths. Add Cmd+Shift+V handling for WYSIWYG paste:

   ```typescript
   case 'c': {
     const cTarget = e.target as HTMLElement;
     if (cTarget.tagName === 'INPUT' || cTarget.tagName === 'TEXTAREA') {
       e.preventDefault();
       const el = cTarget as HTMLInputElement | HTMLTextAreaElement;
       const start = el.selectionStart ?? 0;
       const end = el.selectionEnd ?? start;
       if (start === end) break;
       void electrobun.writeToClipboard(el.value.substring(start, end));
     }
     break;
   }
   case 'x': {
     const xTarget = e.target as HTMLElement;
     if (xTarget.tagName === 'INPUT' || xTarget.tagName === 'TEXTAREA') {
       e.preventDefault();
       const el = xTarget as HTMLInputElement | HTMLTextAreaElement;
       const start = el.selectionStart ?? 0;
       const end = el.selectionEnd ?? start;
       if (start === end) break;
       const selectedText = el.value.substring(start, end);
       el.setRangeText('');
       void electrobun.writeToClipboard(selectedText);
     }
     break;
   }
   case 'v': {
     const vTarget = e.target as HTMLElement;
     if (vTarget.tagName === 'INPUT' || vTarget.tagName === 'TEXTAREA') {
       e.preventDefault();
       void electrobun.readFromClipboard().then((result) => {
         const res = result as { success: boolean; text?: string };
         if (res.success && res.text) {
           document.execCommand('insertText', false, res.text);
         }
       });
     } else if (!sourceModeRef.current) {
       // WYSIWYG: paste via IPC (paste events don't fire in WebView)
       // This branch handles Cmd+Shift+V (not registered as menu accelerator)
       // and is a safety net for Cmd+V if native menu doesn't intercept
       e.preventDefault();
       void clipboard.paste(e.shiftKey);
     }
     // Source mode: let WebView handle natively
     break;
   }
   ```

   **Asymmetry note**: Cmd+V on macOS routes through the menu action handler (`editor-paste` → `clipboard.paste(false)`), while Cmd+Shift+V routes through this keyboard handler (`clipboard.paste(true)`). Both paths converge in the same `paste()` method — only the `plainText` flag differs.

**Test scenarios**:
- Cmd+C in WYSIWYG editor → menu intercepts → `document.execCommand('copy')` → ProseMirror copy fires → clipboardTextSerializer runs
- Cmd+X in WYSIWYG editor → menu intercepts → `document.execCommand('cut')` → ProseMirror cut fires
- Cmd+V in WYSIWYG editor → menu intercepts → `clipboard.paste(false)` → IPC paste
- Cmd+Shift+V in WYSIWYG editor → keyboard handler → `clipboard.paste(true)` → plain text
- Cmd+C in source mode → WebView native copy
- Cmd+C in INPUT/TEXTAREA → keyboard handler IPC path (if menu doesn't intercept for non-ProseMirror targets)
- Edit > Copy menu click → same `editor-copy` action → `document.execCommand('copy')`

**Verification gate**: Before proceeding to Unit 3+, confirm that `document.execCommand('copy')` successfully triggers ProseMirror's `ClipboardEvent` handler with the editor focused. Test with a simple console.log in `clipboardBlobConverter`'s `clipboardTextSerializer`. If this doesn't work, fallback to the existing IPC copy path.

### Unit 3: Extend readFromClipboard RPC for HTML and image data

**Goal**: Backend support for reading HTML content and image data from system clipboard (R6, R10).

**Files**:
- [ ] `src/shared/types.ts` — extend `readFromClipboard` response type (line 279)
- [ ] `src/bun/index.ts` — extend `readFromClipboard` handler (lines 666-714)
- [ ] `src/mainview/lib/electrobun.ts` — update client method signature (lines 185-187)

**Changes**:

1. **types.ts** (line 279): Extend params and response:
   ```typescript
   readFromClipboard: {
     params: { html?: boolean; image?: boolean };
     response: {
       success: boolean;
       text?: string;
       html?: string;
       imageData?: string;   // base64 encoded
       imageFormat?: string; // 'png' | 'tiff'
       error?: string;
     }
   };
   ```

2. **index.ts** (lines 666-714): Extend `readFromClipboard` handler:
   - Accept `{ html?, image? }` params (currently destructures none)
   - Always read text via existing pbpaste/xclip/PowerShell (unchanged)
   - If `html: true`: additionally read HTML via platform-specific commands:
     - macOS: `osascript -e 'the clipboard as «class HTML»'` → decode hex to UTF-8 string
     - Linux: `xclip -selection clipboard -t text/html -o`
     - Windows: PowerShell `Get-Clipboard -Format Html`
   - If `image: true`: check for image data:
     - macOS: `osascript` to write clipboard image to temp file, then read as base64
     - Wrap in try/catch — if no image in clipboard, return imageData as undefined
   - Return `{ success, text, html, imageData, imageFormat }`

3. **electrobun.ts** (lines 185-187): Update client to pass options:
   ```typescript
   async readFromClipboard(options?: { html?: boolean; image?: boolean }) {
     return await electroview.rpc.request.readFromClipboard(options ?? {});
   }
   ```

**Technical note on macOS HTML clipboard**: `osascript -e 'the clipboard as «class HTML»'` returns HTML as a hex-encoded string wrapped in `«data HTML...»` notation. Decode steps:
1. Extract hex content from `«data HTMLXXXX...»` wrapper
2. Parse hex pairs to bytes
3. Decode as UTF-8 (may need to handle BOM markers)
4. If the source encoded as UTF-16 (common for Microsoft Office), detect and decode accordingly

This needs verification during implementation — the exact format may vary across macOS versions. If osascript approach proves unreliable, fallback: use a small Swift helper that accesses NSPasteboard directly.

**Pattern reference**: Existing clipboard handlers in `index.ts:635-714` use platform-specific `spawn` commands. Follow the same pattern with `platform === 'darwin'/'linux'/'win32'` branching.

**Test scenarios**:
- Call with no options → returns text only (backward compatible)
- Call with `{ html: true }` → returns text + html (or html undefined if no HTML in clipboard)
- Call with `{ image: true }` → returns imageData + imageFormat if image in clipboard
- Copy HTML from browser → readFromClipboard({ html: true }) returns HTML string
- Screenshot → readFromClipboard({ image: true }) returns base64 PNG data
- Empty clipboard → returns `{ success: true }` with no content fields
- osascript returns error (no HTML in clipboard) → html field is undefined, not an error

### Unit 4: Smart paste with turndown HTML→markdown conversion

**Goal**: Paste handler that converts HTML to markdown via turndown, with Cmd+Shift+V plain text fallback. Includes self-copy detection for reliable round-trips (R7, R8, R9).

**Files**:
- [ ] `src/mainview/lib/turndown.ts` — NEW: turndown instance with custom rules
- [ ] `src/mainview/hooks/useClipboard.ts` — rewrite paste method
- [ ] `src/mainview/components/editor/hooks/useCrepeEditor.ts` — add `insertMarkdown` method to MilkdownEditorRef

**Changes**:

1. **Install turndown**: `bun add turndown @types/turndown`

2. **`src/mainview/lib/turndown.ts`**: Create configured TurndownService instance:
   - Default rules handle standard HTML (headings, lists, bold, italic, links, tables)
   - Custom rule: strip Google Docs wrapper `<b id="docs-internal-guid-...">`
   - Custom rule: handle `<br>` → `\n` in table cells
   - Configure: `headingStyle: 'atx'`, `bulletListMarker: '-'`, `codeBlockStyle: 'fenced'`
   - Export as singleton `turndownService`

3. **Add `insertMarkdown` to MilkdownEditorRef**: The current API exposes `setMarkdown` (replaces all content) and `insertText` (literal text insertion). Paste needs a method that parses markdown and inserts the resulting ProseMirror nodes at the current cursor position. Add `insertMarkdown(markdown: string)` to the ref interface, implemented via `parserCtx` → `tr.replaceWith()` (pattern from `useCrepeEditor.ts:756-765`):

   ```typescript
   const insertMarkdown = useCallback((markdown: string) => {
     const crepe = crepeRef.current;
     if (!crepe?.editor.ctx) return;
     crepe.editor.action((ctx) => {
       const view = ctx.get(editorViewCtx);
       const parser = ctx.get(parserCtx);
       const doc = parser(markdown);
       if (doc && doc.content.size > 0) {
         const { from } = view.state.selection;
         const tr = view.state.tr.replaceWith(from, from, doc.content);
         view.dispatch(tr);
       }
     });
   }, []);
   ```

4. **`src/mainview/hooks/useClipboard.ts`**: Rewrite `paste(plainText?: boolean)` method:
   - Accept `plainText?: boolean` parameter
   - Call `electrobun.readFromClipboard({ html: !plainText, image: !plainText })`
   - Decision tree:
     1. If image data exists → delegate to image paste (Unit 5)
     2. If `plainText` → insert raw text via `editor.insertText()`
     3. **Self-copy detection**: If both HTML and text exist, check if text is valid markdown (heuristic: text starts with `#`, `---`, `-`, `*`, `>`, `[`, `!`, or contains `](...)` patterns). If the text appears to be serialized markdown from our `clipboardTextSerializer`, prefer text over HTML for a more reliable round-trip.
     4. If HTML exists (and text is not self-copy markdown) → `turndownService.turndown(html)` → process via `processFromClipboard()` → insert via `insertMarkdown()`
     5. If only text → process via `processFromClipboard()` → insert via `insertMarkdown()`
   - Copy/cut methods: keep as thin wrappers that call `editorRef.current?.focus()` then `document.execCommand('copy'/'cut')` for menu action compatibility

**Why self-copy detection matters**: When copying within MarkBun, the clipboard has both `text/html` (ProseMirror DOM serialization) and `text/plain` (our `clipboardTextSerializer` output which is clean markdown). Using turndown on the HTML would produce markdown through a lossy HTML→markdown conversion, while the text/plain is already the exact markdown we want. Detecting this case avoids unnecessary conversion artifacts.

**Pattern reference**: `useCrepeEditor.ts:756-765` shows how to parse markdown and insert into ProseMirror via `parserCtx` → `tr.replaceWith()`.

**Test scenarios**:
- Paste plain text → inserted as-is
- Paste HTML from browser (with bold, links) → converted to markdown (bold, links)
- Paste HTML from Google Docs → Google wrapper stripped, content preserved
- Paste HTML table → converted to markdown table
- Cmd+Shift+V → plain text inserted, no markdown/turndown processing
- Copy within MarkBun → paste back → text/plain preferred (no turndown artifacts)
- Paste content with local image paths → paths converted to blob URLs
- `insertMarkdown` with `# Heading` → parsed and inserted as heading node at cursor

### Unit 5: Image paste support

**Goal**: Detect clipboard images (screenshots), save to workspace, insert markdown reference (R10).

**Files**:
- [ ] `src/mainview/hooks/useClipboard.ts` — add image paste handling in paste method

**Changes**:

1. **In paste method** (from Unit 4): When `imageData` is present:
   - Check workspace root: `const workspaceRoot = workspaceManager.getWorkspaceRoot()` — if null, log error and return false (cannot save without workspace)
   - Generate filename: `clipboard-{Date.now()}.png`
   - Call `electrobun.saveDroppedImage(filename, imageData, workspaceRoot)` — reuse existing drag-drop pipeline
   - Check result: if `!saveResult.success || !saveResult.relativePath`, log error and continue
   - Call `loadLocalImage(saveResult.absolutePath)` — if returns null, log error and continue
   - Insert `![image](blobUrl)` via `insertMarkdown()` at cursor position

2. **Priority**: Check image data BEFORE HTML/text — if clipboard has both image and text (e.g., copied image file from Finder), prefer image.

**Pattern reference**: `useCrepeEditor.ts:697-768` shows the full image save+insert flow for drag-drop. Reuse `saveDroppedImage` RPC (which handles deduplication and `.assets/` directory creation) and `loadLocalImage` for blob URL generation. Both return null on failure — must be guarded.

**Test scenarios**:
- Screenshot (Cmd+Shift+4) → Cmd+V → image saved to workspace `.assets/`, `![](relative/path)` inserted
- Copy image from browser → Cmd+V → image saved and inserted
- Clipboard has both image and text → image takes priority
- No workspace root set → returns false, logs error, no silent failure
- `loadLocalImage` returns null → logs error, no partial insert
- Large image → saved correctly without truncation

## Dependencies

- **turndown** + **@types/turndown**: New npm dependency (R7)
- **Existing infrastructure**: `saveDroppedImage` RPC, `loadLocalImage`, `processFromClipboard`, `prepareForClipboard` — all already implemented

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| `document.execCommand('copy')` doesn't trigger ProseMirror handler from RPC context | Unit 2 blocked | **Verification gate**: test immediately in Unit 2. Fallback: keep IPC copy path with manual HTML serialization |
| macOS osascript HTML format not as expected | Unit 3 blocked | Verify during implementation; fallback: NSPasteboard Swift helper |
| Electrobun native menu double-fires (consumes event AND sends to WebView) | Duplicate paste | Test during Unit 2; if double-fire occurs, add dedup flag in menu action handler |
| turndown produces poor markdown for complex HTML | UX degradation | Best-effort per scope boundaries. Self-copy detection avoids this for internal round-trips |
| `convertCodeBlockToFrontmatter` false positive on normal yaml blocks | Data corruption | Regex `^` anchor ensures only selection-start code blocks match |
| Paste race condition (cursor moves during async IPC) | Content inserted at wrong position | Pre-existing issue; increased latency from HTML/image reading makes it slightly worse. Defer to future fix |
| `insertMarkdown` doesn't handle all markdown constructs | Paste fails for complex content | Uses same `parserCtx` as `setMarkdown` — same parsing capabilities |

## Verification Strategy

### Unit 2 verification gate (critical — blocks Units 3-5)

Before proceeding, confirm:
1. `editorRef.current?.focus()` successfully focuses the ProseMirror element
2. `document.execCommand('copy')` fires a `copy` event on the `.ProseMirror` element
3. The `clipboardTextSerializer` in `clipboardBlobConverter` runs and produces correct output
4. The clipboard contains both `text/html` and `text/plain` with expected content

If any of these fail, fallback: keep IPC copy path but enhance `clipboard.copy()` to write both `text/html` and `text/plain` via a new `writeToClipboardRich` RPC.

### Manual test checklist (per success criteria)

1. Copy in WYSIWYG → paste back: format preserved
2. Copy formatted text from MarkBun → paste in browser/Slack: visible formatting
3. Copy HTML from browser → paste in MarkBun: correct markdown
4. Screenshot → Cmd+V in MarkBun: image saved and referenced
5. Cmd+Shift+V: plain text paste
6. Copy frontmatter document → clipboard has `---` format
7. Source mode copy/cut/paste: unchanged
8. INPUT/TEXTAREA copy/cut/paste: unchanged
9. Edit > Copy menu click → same result as Cmd+C
10. Copy within MarkBun → paste back → no format loss (self-copy detection)

### Automated test scenarios

- Unit 1: Test `convertCodeBlockToFrontmatter` on yaml code block string, verify `---` output
- Unit 3: Test macOS HTML hex decoding with known hex input → expected HTML string
- Unit 3: Test `readFromClipboard` with mock platform commands
- Unit 4: Test turndown configuration with sample HTML inputs
- Unit 4: Test self-copy detection heuristic with markdown-like text vs HTML text

## Implementation Order

```
Unit 1 (frontmatter extract + clipboardBlobConverter)
  ↓
Unit 2 (App.tsx: menu action + keyboard handler) ← VERIFICATION GATE HERE
  ↓                                               confirm execCommand works
Unit 3 (backend: readFromClipboard extension)  ← can start parallel with Unit 2
  ↓
Unit 4 (insertMarkdown + turndown + smart paste)  ← depends on Unit 2 + Unit 3
  ↓
Unit 5 (image paste)                              ← depends on Unit 4 paste framework
```

Unit 1 is the foundation — it ensures `clipboardTextSerializer` produces correct output. Unit 2 has a **verification gate**: confirm `document.execCommand('copy')` triggers ProseMirror's handler before committing to Units 3-5. If the gate fails, switch to fallback (IPC copy with rich format support). Units 3-5 are incremental builds on the paste pipeline.
