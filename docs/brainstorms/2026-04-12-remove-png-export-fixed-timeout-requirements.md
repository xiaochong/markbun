---
date: 2026-04-12
topic: remove-png-export-fixed-timeout
---

# Remove the Fixed 3-Second Timeout in PNG Export

## Problem Frame

PNG export in `src/mainview/hooks/useExport.ts` currently waits for KaTeX and Mermaid CDN scripts to load inside an isolated iframe using a hardcoded `setTimeout(resolve, 3000)`. This fixed timeout:
- Leaves a dangling timer even when scripts finish early, which can delay task-queue throughput and wastes time.
- Fails to render math or diagrams on slow networks if scripts take longer than 3 seconds, silently producing incomplete exports.
- Was previously necessary because the code relied solely on the timeout rather than proper `onload`/`onerror` completion tracking.

## Requirements

**Script Loading**
- R1. Replace the unconditional `setTimeout(resolve, 3000)` in `generateImage` with event-driven resolution: the export proceeds as soon as all three CDN scripts (`katex.min.js`, `auto-render.min.js`, `mermaid.min.js`) have fired `onload` or `onerror`.
- R2. Keep a fallback timeout (e.g. 10 seconds) that only resolves if not all scripts have finished by then, and clear it once the scripts complete to avoid dangling timers.
- R3. On individual `onerror`, log a warning so export failures are observable rather than silent.

**Scope Boundaries**
- This requirement only covers the script-loading wait inside the iframe (`src/mainview/hooks/useExport.ts`).
- The separate 1-second image-loading timeout (`img` tags inside the iframe) is explicitly out of scope unless fixing it requires trivial adjacent changes.

## Success Criteria
- Fast-network exports no longer pay a fixed 3-second penalty when scripts load quickly.
- Slow-network exports get a reasonable grace period (fallback timeout) instead of cutting off at 3 seconds.
- No dangling timers remain after script loading completes.

## Key Decisions
- **Fallback timeout: 10 seconds.** This is more forgiving for slow connections while still preventing an indefinite hang.
- **Count both `onload` and `onerror` as "finished".** Export should continue even if one script fails, matching the current behavior but without the arbitrary cutoff.

## Next Steps
→ `/ce:plan` for structured implementation planning
