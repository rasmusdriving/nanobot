# Iter 10 UI Audit Findings

Date: 2026-02-06
Scope: Desktop 1728x973, Tablet 1024x768, Mobile 390x844

## Resolved in this iteration

- [P1] Raw JSON parse banner leaked HTML doctype text.
  - Repro: load app without backend/proxy; banner showed `Unexpected token '<'...`.
  - Fix: added robust JSON response parsing with friendly API/proxy error in `web/src/api.ts`.

- [P1] Utility drawer remained in accessibility tree/layout when visually closed.
  - Repro: on load with Utilities closed, screen reader snapshot still exposed Operations drawer.
  - Fix: drawer now uses `hidden`/`aria-hidden` when closed and hidden state styles in `web/src/features/ops/UtilityDrawer.tsx` + `web/src/styles/drawer.css`.

- [P1] Draft thread plus “No sessions match your search” showed simultaneously.
  - Repro: no sessions loaded, draft session selected.
  - Fix: suppress empty-state copy when draft session is present in `web/src/features/chat/ThreadRail.tsx`.

- [P1] Mobile/tablet drawer-overlap and horizontal overflow after opening Utilities.
  - Repro: open Utilities on 390x844; sheet overlapped with notice/top stack and produced large off-canvas area.
  - Fix: stacking and responsive grid adjustments in `web/src/styles/layout.css` and `web/src/styles/responsive.css`.

## Remaining findings

- [P2] Notice banner can still visually compete with overlays in small viewports.
  - Repro: show notice, open Utilities or Token on mobile; close spacing can feel crowded.
  - Recommendation: hide/dock notice while utility sheet is open, or convert notice to topbar chip + expandable details.

- [P2] Mobile utility sheet currently anchors from top and occupies most viewport, reducing chat context.
  - Repro: 390x844 with Utilities open.
  - Recommendation: convert to bottom sheet with snap points (e.g., 52% / 88%) and dim backdrop for clearer modality.

- [P2] Token popover on mobile is functional but not modalized; background remains interactive visually.
  - Repro: open Token while Utilities open on mobile.
  - Recommendation: use full-width mobile token sheet with backdrop and explicit close affordance.

## Artifacts

Screenshots for this cycle are in this folder with deterministic names:
- `desktop-10-home.png`
- `desktop-11-utilities-overview.png`
- `desktop-12-panel-*.png`
- `desktop-13-token-over-utilities.png`
- `desktop-14-long-thread-composer-visible.png`
- `tablet-20-home.png`
- `tablet-21-threads-sheet.png`
- `tablet-22-utilities-sheet.png`
- `tablet-23-token.png`
- `mobile-35-utilities-after-gridfix.png`
- `mobile-36-token-after-gridfix.png`

## Validation results

- `npx tsc --noEmit` ✅
- `npm run test` ✅ (17 tests)
- `npm run build` ✅
