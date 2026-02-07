# Iter 11 UI Audit Findings (Desktop Utilities Takeover)

Date: 2026-02-07
Scope: Desktop 1728x973 primary flow

## Verified outcomes

- [PASS] Utilities now enters full desktop takeover mode.
  - Repro: click `Utilities` in topbar.
  - Result: thread rail + chat are hidden from view; utilities occupies workspace.

- [PASS] Threads control is disabled while desktop utilities mode is active.
  - Repro: open Utilities takeover mode.
  - Result: Threads button disabled; prevents mixed-mode conflicts.

- [PASS] Escape closes desktop utilities mode.
  - Repro: open Utilities, press `Esc`.
  - Result: returns to chat view.

- [PASS] Focus restoration works after Escape close.
  - Repro: open Utilities, press `Esc`.
  - Result: focus returns to topbar `Utilities` button.

- [PASS] Token popover layers correctly above utilities workspace.
  - Repro: open Utilities, click `Token`.
  - Result: popover appears above workspace and remains interactable.

- [PASS] Panel switching still works across all utility panels.
  - Repro: switch `Overview`, `Schedules`, `Heartbeat`, `Skills`, `Config`, `Diagnostics`.
  - Result: correct panel content shown for each.

## Remaining findings

- [P2] Config long-content scroll validation is constrained by mock data state.
  - Repro: current local backend-unavailable state yields minimal config payload.
  - Result: no overflow regression observed, but true long-form behavior should be rechecked with live payloads.
  - Recommendation: re-run with real config/skills data and verify content-pane-only scroll under heavy payload.

- [P2] Utilities close affordance label still says "Close drawer" in workspace mode.
  - Repro: open desktop utilities takeover.
  - Result: behavior is correct, but terminology is legacy.
  - Recommendation: rename aria-label/text to "Close utilities" for consistency.

## Artifacts

Screenshots:
- `desktop-00-chat-baseline.png`
- `desktop-01-utilities-takeover.png`
- `desktop-02-panel-overview.png`
- `desktop-02-panel-schedules.png`
- `desktop-02-panel-heartbeat.png`
- `desktop-02-panel-skills.png`
- `desktop-02-panel-config.png`
- `desktop-02-panel-diagnostics.png`
- `desktop-03-token-over-utilities.png`
- `desktop-04-escape-back-chat.png`
- `desktop-05-config-long-editor.png`

## Validation results

- `npx tsc --noEmit` ✅
- `npm run test` ✅ (20 tests)
- `npm run build` ✅
