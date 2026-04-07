---
date: 2026-04-07
topic: mermaid-zoom-pan
---

# Allow Zoom + Pan for Large Mermaid Diagrams

## Problem Frame

Users inserting large Mermaid diagrams (especially sequence diagrams, flowcharts with many nodes) into MarkBun documents cannot comfortably read or navigate them. Diagrams are squeezed to fit the editor width, making text illegible and structure hard to follow. There is currently no way to zoom into or pan around a diagram.

## Requirements

**Context Menu Trigger**
- R1. Right-clicking on a Mermaid diagram preview (non-selected state) in the editor must show a context menu that includes a "View Diagram" (查看图表) option.
- R2. The existing default editor context menu items (undo, redo, cut, copy, paste, etc.) should remain available alongside the new "View Diagram" option when right-clicking on a Mermaid block.
- R3. The "View Diagram" option must only appear when the right-click target is within a Mermaid code block's preview area. It must not appear for other code blocks or general editor content.

**Diagram Viewer Modal**
- R4. Selecting "View Diagram" must open a modal overlay that covers most of the editor area, with a semi-transparent backdrop dimming the content behind it.
- R5. The modal must display the full rendered Mermaid SVG diagram, re-rendered at native resolution (not scaled down from the inline preview).
- R6. The modal must have a prominent close button (top-right corner) and also close on Escape key press and on clicking the backdrop area outside the diagram.

**Zoom and Pan Interaction**
- R7. The modal must support mouse wheel scroll to zoom in/out, centered on the cursor position.
- R8. The modal must provide zoom in (+) and zoom out (-) toolbar buttons in a top toolbar bar, along with a percentage display (e.g., "150%") and a reset button to return to fit-to-view state.
- R9. The modal must support click-and-drag panning whenever the diagram dimensions exceed the visible viewport (which may occur at any zoom level, including the initial fit-to-view scale for very large diagrams).
- R10. Zoom range must be between 10% and 500%. Panning must work naturally within this range without the diagram snapping or jumping.
- R11. The cursor must change to "grab" when the diagram exceeds the viewport and panning is available, and "grabbing" while actively dragging.

**Initial Display**
- R12. On open, the diagram must be displayed in "fit to view" mode — scaled so the entire diagram is visible within the modal, regardless of the diagram's natural SVG dimensions.

**Loading and Error States**
- R13. The modal must show a loading indicator (e.g., spinner with "Rendering diagram..." text) while the Mermaid diagram is being rendered.
- R14. If rendering fails (syntax error or other failure), the modal must display an error message with the option to close.

**Keyboard Shortcuts**
- R15. The modal must support keyboard shortcuts: `+` / `=` to zoom in, `-` to zoom out, `0` to reset to fit-to-view, and arrow keys to pan when the diagram exceeds the viewport.

## Success Criteria
- A user can right-click a Mermaid diagram, open the modal viewer, and comfortably read and navigate a large diagram using scroll zoom, button zoom, drag panning, and keyboard shortcuts.
- The modal renders diagrams at full quality with no blurriness at any zoom level.
- Loading and error states are clearly communicated to the user during rendering.
- The interaction feels smooth and natural, comparable to the existing ImageViewer zoom/pan experience.

## Scope Boundaries
- No zoom/pan in the inline editor preview — only in the modal viewer.
- No editing capability in the modal — it is view-only.
- No separate native window — only modal overlay within the current window.
- No support for LaTeX or HTML preview blocks in this iteration — Mermaid only.

## Key Decisions
- **Modal overlay over separate window**: Simpler implementation, no multi-window state management needed, consistent with the app's single-window UX.
- **Context menu trigger over double-click or hover button**: Keeps inline preview clean, leverages the existing native context menu infrastructure.
- **Re-render diagram in modal rather than reuse inline SVG**: Ensures full quality rendering without inheriting any inline scaling artifacts.

## Dependencies / Assumptions
- The existing native context menu system (`ContextMenu` API from Electrobun) can be extended with a new context menu variant or a conditional menu item.
- The existing `ImageViewer` zoom/pan interaction pattern can be adapted for SVG content.
- Mermaid rendering can be re-invoked in the modal context with the same source code from the code block.

## Outstanding Questions

### Deferred to Planning
- [Affects R1][Technical] How to detect the right-click target is a Mermaid block — via DOM class/attribute inspection in `useContextMenu.ts` or ProseMirror node type checking?
- [Affects R5][Technical] Whether to pass the raw Mermaid source text to the modal and re-render, or pass the rendered SVG markup directly. Re-rendering ensures full quality but adds a brief loading state.
- [Affects R4][Needs research] The exact modal sizing and backdrop styling — should follow existing dialog patterns in the app (e.g., SettingsDialog, RecoveryDialog).

## Next Steps
-> `/ce:plan` for structured implementation planning
