# Plan: GridWatch Performance Optimisation

## Problem Statement

As the Sessions page now displays significantly more data per session (user messages, token history, compaction events, rewind snapshots, context cost, files modified), the app has begun to slow down — particularly for users with many sessions and large log files. The entire session dataset is loaded into memory, serialised across the IPC bridge, and re-rendered on a 30-second refresh cycle with no delta detection, virtualisation, or streaming.

## Proposed Approach

Address performance in three layers — **main process** (data loading and IPC), **renderer** (React rendering and memoisation), and **architecture** (structural changes for long-term scalability). Each increment is independently testable and delivers measurable improvement. Quick wins are prioritised first to deliver immediate value.

---

## Tasks

### Phase 1 — Quick Wins (Renderer) ✅ COMPLETE

#### 1. Wrap SessionsPage and SkillsPage in React.memo

`SessionsPage` and `SkillsPage` are the only page components not wrapped in `React.memo()`. Every 30-second refresh triggers a full re-render of the active page even when the `sessions` array reference has not changed.

**Files:** `src/pages/SessionsPage.tsx`, `src/pages/SkillsPage.tsx`

**Verification:** Open React DevTools Profiler, trigger a refresh, and confirm that pages do not re-render when their props are referentially equal.

---

#### 2. Memoise reversed and derived arrays in the detail panel

The detail panel creates new array objects on every render — notably `[...selectedSession.userMessages].reverse()` — which breaks referential equality and forces child re-renders. Wrap these derivations in `useMemo`.

**Files:** `src/pages/SessionsPage.tsx` (detail panel section)

**Verification:** Profile with React DevTools; confirm the detail panel does not re-render when the selected session object has not changed.

---

#### 3. Debounce search input on SessionsPage

The search field triggers `useMemo` filter recomputation on every keystroke. Add a 250ms debounce so the expensive filter only runs after the user stops typing.

**Files:** `src/pages/SessionsPage.tsx`

**Verification:** Type rapidly in the search box and confirm via console.log or profiler that the filter runs once after a pause, not on every keystroke.

---

#### 4. Prevent unnecessary detail panel re-syncs on refresh

The `useEffect` that syncs the selected session re-runs on every `sessions` array change. Guard it with a shallow comparison (e.g. compare `updatedAt` timestamps) so the detail panel only re-renders when the selected session has genuinely changed.

**Files:** `src/pages/SessionsPage.tsx` (useEffect around line 123–128)

**Verification:** Select a session, wait for a 30-second refresh, and confirm via React DevTools that the detail panel does not re-render if nothing changed.

---

### Phase 2 — IPC and Data Layer ✅ COMPLETE

#### 5. Implement delta/diff-based session refresh

Instead of serialising the entire `SessionData[]` array on every 30-second refresh, introduce a lightweight `sessions:get-summaries` IPC channel that returns only `{ id, updatedAt }[]`. The renderer compares timestamps and only fetches full data for sessions that have changed via a new `sessions:get-by-id` channel.

**Files:** `electron/main.ts`, `electron/preload.ts`, `src/types/global.d.ts`, `src/App.tsx`

**Verification:** Add logging to the IPC handler; confirm that after initial load, subsequent refreshes only transfer data for changed sessions. Measure IPC payload size before and after.

---

#### 6. Lazy-load expensive session fields

Not all fields are needed for the session list view. Split the session data into a **summary** (id, summary, repository, branch, createdAt, updatedAt, turnCount, tags, isResearch, isReview) and **detail** (userMessages, tokenHistory, compactions, rewindSnapshots, filesModified, contextCost). Load detail fields only when a session is selected.

**Files:** `electron/main.ts`, `electron/preload.ts`, `src/types/session.ts`, `src/types/global.d.ts`, `src/pages/SessionsPage.tsx`

**Verification:** Measure IPC payload size for the session list. It should be significantly smaller. Confirm detail fields load on session selection without visible delay.

---

#### 7. Stream large file reads in the main process

`events.jsonl` and process log files are read synchronously into memory with `fs.readFileSync`. Replace with streaming reads using `fs.createReadStream` and `readline` for line-by-line processing. This avoids memory spikes for sessions with large event histories.

**Files:** `electron/main.ts` (events.jsonl parsing ~line 306, log file parsing ~line 151, log tokens ~line 501)

**Verification:** Create a test session with a large `events.jsonl` (>5MB). Monitor memory usage in Electron's Task Manager before and after the change. Confirm memory does not spike.

---

#### 8. Increase and tier the IPC cache TTL

The current 5-second cache TTL for sessions means the expensive parsing runs frequently. Increase the default TTL to 15–30 seconds (matching the renderer's refresh interval) and introduce a `force` parameter for user-initiated actions that need fresh data.

**Files:** `electron/main.ts` (cache configuration ~line 101–108)

**Verification:** Add timing logs to the sessions handler. Confirm that within the TTL window, cached data is returned without re-parsing. Verify that mutations (rename, delete, archive) still invalidate the cache correctly.

---

### Phase 3 — Rendering Scalability

#### 9. Virtualise the session card list

Replace the paginated `.map()` rendering of session cards with a virtualised list using `react-window` (or similar). This ensures only visible cards are in the DOM, regardless of how many sessions exist.

**Files:** `src/pages/SessionsPage.tsx`, `package.json` (new dependency)

**Verification:** Load 200+ sessions. Confirm smooth scrolling with no jank. Inspect the DOM and verify that only ~15–20 card elements exist at any time, not the full list.

---

#### 10. Virtualise long lists in the detail panel

The user messages list, rewind snapshots, and compaction events in the detail panel can grow large. Virtualise these lists so only visible items are rendered.

**Files:** `src/pages/SessionsPage.tsx` (detail panel lists)

**Verification:** Select a session with 50+ user messages. Confirm smooth scrolling and a limited number of DOM nodes via DevTools Elements panel.

---

#### 11. Combine multiple data passes in ActivityPage

`ActivityPage` runs four separate `.reduce()` / `.map()` passes over the filtered sessions array (session count by day, repo grouping, tool grouping, day-of-week grouping). Combine these into a single pass to reduce iteration overhead.

**Files:** `src/pages/ActivityPage.tsx`

**Verification:** Add `console.time`/`console.timeEnd` around the computation. Confirm a measurable reduction in processing time with 100+ sessions.

---

### Phase 4 — Architecture (Long-Term)

#### 12. Introduce a lightweight state management layer

Currently, the full `sessions` array is prop-drilled from `App.tsx` to all pages. Introduce a lightweight state manager (e.g. Zustand or React Context with `useSyncExternalStore`) so that:
- Pages subscribe only to the data they need.
- Session list changes don't force re-renders of pages that only need aggregate data (Tokens, Activity).
- The selected session state is centralised rather than local to SessionsPage.

**Files:** New `src/store/` directory, `src/App.tsx`, all page components

**Verification:** Profile with React DevTools. Confirm that switching pages or refreshing data only re-renders the active page, and that inactive pages remain unmounted without stale subscriptions.

---

#### 13. Move expensive computations to a Web Worker

Chart data aggregation (token history, heatmap cells, tool usage stats) can be offloaded to a Web Worker so the main renderer thread is never blocked during computation. This is especially important as data volumes grow.

**Files:** New `src/workers/` directory, `src/pages/TokensPage.tsx`, `src/pages/ActivityPage.tsx`

**Verification:** Block the main thread with a long computation in the worker. Confirm the UI remains responsive (scrolling, clicking) whilst the worker processes.

---

#### 14. Add performance monitoring and regression detection

Introduce lightweight performance markers using `performance.mark()` and `performance.measure()` for key operations:
- IPC round-trip time for `sessions:get-all`
- React render time for SessionsPage
- Time-to-interactive after page switch

Log these to the console in dev mode and optionally to a performance overlay.

**Files:** `electron/main.ts`, `src/App.tsx`, `src/pages/SessionsPage.tsx`

**Verification:** Open DevTools Performance tab, trigger a refresh, and confirm custom markers appear in the timeline. Verify baseline measurements are logged.

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Virtualisation libraries add bundle size | Larger app download, slower cold start | `react-window` is ~6KB gzipped — negligible impact. Measure bundle size before and after. |
| Delta refresh logic introduces stale data bugs | Users see outdated session info | Always invalidate on mutations. Add an integration test that mutates a session and verifies the renderer sees the change within one refresh cycle. |
| Streaming file reads change parsing behaviour | Subtle data loss if line splitting differs | Add unit tests comparing streamed output against the current synchronous output for the same test files. |
| Web Worker serialisation overhead | Slower for small datasets due to postMessage cost | Only offload computations that exceed a threshold (e.g. >50 sessions). Fall back to main thread for small datasets. |
| State management migration introduces regressions | Broken data flow, missing updates | Migrate one page at a time. Keep prop-drilling as a fallback until each page is verified. |
| Lazy-loading detail fields adds perceived latency | Users see a loading spinner when selecting a session | Pre-fetch detail data for the most recently updated sessions. Use optimistic UI with skeleton placeholders. |

## Security

No security concerns are introduced by these changes. All optimisations are internal to the app's data flow and rendering pipeline. Specifically:

- No new IPC channels expose sensitive data beyond what is already accessible.
- Streaming file reads use the same `fs` APIs with the same file-system permissions.
- Web Workers run in the same origin sandbox as the renderer.
- No new dependencies introduce network access or credential handling.
- The read-only contract with Copilot session files is preserved — GridWatch never writes to `workspace.yaml`, `events.jsonl`, or any Copilot-owned file.

## Accessibility

#### Virtualised lists must maintain keyboard navigation
- Ensure virtualised session cards and detail panel lists remain navigable via Tab / Arrow keys.
- `react-window` supports `role="listbox"` and `aria-rowcount` — configure these attributes.
- Test with VoiceOver (macOS) to confirm screen readers announce item count and position (e.g. "item 3 of 47").

#### Loading states for lazy-loaded data
- When detail fields load asynchronously, provide an `aria-busy="true"` attribute on the detail panel container.
- Use skeleton placeholders with appropriate `aria-label` (e.g. "Loading session details").
- Ensure focus is not lost when the detail panel transitions from loading to loaded state.

#### Debounced search must announce results
- After the debounced filter completes, use an `aria-live="polite"` region to announce the result count (e.g. "12 sessions found").
- Ensure the search input retains focus during and after filtering.

## User Guidance

#### Virtualised scrolling
- No user-facing guidance needed — virtualisation is transparent to the user.

#### Loading indicators for lazy-loaded detail
- Display a subtle skeleton/shimmer animation in the detail panel whilst data loads.
- If loading takes longer than 500ms, show a brief "Loading session details…" message.

#### Search debouncing
- No user-facing guidance needed — the debounce delay (250ms) is imperceptible. The existing search placeholder text is sufficient.

#### Performance metrics (dev mode only)
- Add a tooltip on the version label in the sidebar: "Open DevTools to see performance metrics" (only visible in dev builds).
