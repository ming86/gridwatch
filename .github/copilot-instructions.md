# GitHub Copilot Instructions for GridWatch

## Project overview

**GridWatch** is a cross-platform Electron desktop app that reads GitHub Copilot CLI's local session data (`~/.copilot/session-state/`) and presents it as a real-time dashboard. It uses a retro Tron-inspired design with neon cyan, electric blue, and orange accents on near-black backgrounds.

**Stack:** Electron + React 19 + TypeScript + Vite + CSS Modules + Recharts  
**Author:** Faesel Saeed  
**License:** MIT

---

## Architecture

### Process model

```
Main process (electron/main.ts)
  └── All file system access
  └── All IPC handlers (ipcMain.handle)
  └── Window management

Preload (electron/preload.ts)
  └── contextBridge.exposeInMainWorld('gridwatchAPI', {...})
  └── Also exposes webFrame.setZoomFactor / getZoomFactor

Renderer (src/)
  └── React app — NO direct Node.js access
  └── Communicates with main only via window.gridwatchAPI
```

### Data sources (read-only, never modified by GridWatch)

| File | Contents |
|---|---|
| `~/.copilot/session-state/<uuid>/workspace.yaml` | id, cwd, repository, branch, summary, created_at, updated_at |
| `~/.copilot/session-state/<uuid>/events.jsonl` | session.start, user.message (field: `data.content`), tool.execution_start |
| `~/.copilot/session-state/<uuid>/rewind-snapshots/index.json` | Checkpoint snapshots with user prompts |
| `~/.copilot/logs/process-<ms-timestamp>-<pid>.log` | Token utilisation lines: `CompactionProcessor: Utilization X% (NNNN/128000 tokens)` |

### Custom data (written by GridWatch)

| File | Contents |
|---|---|
| `~/.copilot/session-state/<uuid>/gridwatch.json` | `{ "tags": ["tag1", "tag2"] }` |
| `localStorage` (renderer) | `gridwatch-settings` — zoom, fontSize, spacing |

---

## Project structure

```
gridwatch/
├── .github/
│   ├── copilot-instructions.md   ← this file
│   ├── CONTRIBUTING.md
│   └── ISSUE_TEMPLATE/
│       ├── bug_report.md
│       └── feature_request.md
├── electron/
│   ├── main.ts                   ← main process, all IPC handlers
│   └── preload.ts                ← contextBridge, webFrame zoom
├── src/
│   ├── pages/
│   │   ├── SessionsPage.tsx      ← session list + detail panel (rename/archive/delete/tags/history)
│   │   ├── TokensPage.tsx        ← token usage charts (line + bar + per-session table)
│   │   ├── ActivityPage.tsx      ← heatmap, top repos, tool usage, day-of-week chart
│   │   └── SettingsPage.tsx      ← UI scale / font size / density; applySettings(), loadSettings()
│   ├── types/
│   │   ├── session.ts            ← SessionData, TokenDataPoint, RewindSnapshot interfaces
│   │   └── global.d.ts          ← Window.gridwatchAPI declarations
│   ├── App.tsx                   ← shell, sidebar (sidebarTop/sidebarBottom), auto-refresh, PageErrorBoundary
│   ├── App.module.css
│   └── index.css                 ← Tron CSS variables, global reset, density overrides
├── public/
│   └── icon.png                  ← 1024×1024 app icon
├── build/
│   └── icon.png                  ← same icon, for electron-builder
├── LICENSE                       ← MIT
└── README.md
```

---

## IPC API surface (`window.gridwatchAPI`)

| Method | IPC channel | Description |
|---|---|---|
| `getSessions()` | `sessions:get-all` | Returns `SessionData[]` sorted by updatedAt desc |
| `getLogTokens()` | `sessions:get-log-tokens` | Returns `{ date, tokens, utilisation }[]` per log file |
| `renameSession(id, summary)` | `sessions:rename` | Rewrites summary in workspace.yaml |
| `archiveSession(id)` | `sessions:archive` | Moves session dir to `~/.copilot/session-state-archived/` |
| `deleteSession(id)` | `sessions:delete` | `fs.rmSync` the session dir |
| `setTags(id, tags[])` | `sessions:set-tags` | Writes/merges tags into `gridwatch.json` |
| `setZoomFactor(n)` | — (webFrame) | Electron native zoom, correct viewport scaling |
| `getZoomFactor()` | — (webFrame) | Returns current zoom factor |

**Guards:** archive and delete refuse if `updatedAt` is within 2 minutes of now (active session protection).

---

## SessionData type

```typescript
interface SessionData {
  id: string
  cwd: string
  gitRoot?: string
  repository?: string
  branch?: string
  summary?: string
  summaryCount: number
  createdAt: string        // always ISO string — js-yaml returns Date objects, convert with new Date(...).toISOString()
  updatedAt: string        // same
  turnCount: number
  toolsUsed: string[]
  copilotVersion?: string
  lastUserMessage?: string
  userMessages: string[]   // all user.message events, field: event.data.content
  tags: string[]           // from gridwatch.json
  rewindSnapshots: RewindSnapshot[]
  filesModified: string[]
  peakTokens: number
  peakUtilisation: number
  tokenHistory: TokenDataPoint[]
}
```

---

## Critical gotchas

### js-yaml date conversion
js-yaml automatically converts ISO date strings in YAML to JavaScript `Date` objects. Electron IPC uses structured clone (not JSON), so `Date` objects arrive in the renderer as `Date` objects — NOT strings. Always convert in main.ts:
```typescript
const createdAt = new Date(workspace.created_at || Date.now()).toISOString()
```

### Zoom scaling
Use `webFrame.setZoomFactor()` (exposed via preload), NOT `document.body.style.zoom`. The latter distorts `100vh` causing content to overflow the viewport. `webFrame` correctly adjusts the viewport.

### Recharts ResponsiveContainer height
Always provide an explicit pixel `height` to `<ResponsiveContainer>` — never `height="100%"` unless the parent has an explicit pixel height.

### Token chart X-axis duplicates
Multiple log files can share the same date string (multiple sessions per day). Always aggregate `logTokens` by date before passing to charts:
```typescript
const lineMap = new Map<string, number>()
logTokens.forEach(e => { if (e.tokens > (lineMap.get(e.date) || 0)) lineMap.set(e.date, e.tokens) })
```

### events.jsonl user message field
The field is `event.data.content`, **not** `event.data.message`.

---

## Design system

All design tokens are CSS custom properties in `src/index.css`:

```css
--tron-bg:          #060a14    /* main background */
--tron-panel:       #0a0e1f    /* card/panel background */
--tron-cyan:        #00f5ff    /* primary accent — titles, active state */
--tron-blue:        #0080ff    /* secondary accent — section labels, bars */
--tron-orange:      #ff6600    /* destructive actions, active nav indicator */
--tron-text:        #c0e8ff    /* body text */
--tron-text-dim:    #4a7a9b    /* muted/secondary text */
--tron-border:      #1a2a4a    /* borders */
--tron-glow-cyan:   0 0 8px rgba(0, 245, 255, 0.4)
--tron-glow-orange: 0 0 8px rgba(255, 102, 0, 0.4)
--sidebar-width:    160px
```

Density variants are applied via `data-density` attribute on `<html>`:
- `compact` — reduced padding on cards and nav items
- `default` — standard
- `comfortable` — increased padding

---

## App layout

```
┌─────────────────────────────────────────────────┐
│ Titlebar (44px, hiddenInset macOS, traffic 16,12)│
├──────────┬──────────────────────────────────────┤
│ Sidebar  │ Content (overflow-y: auto)            │
│ (160px)  │                                       │
│          │  <SessionsPage | TokensPage |          │
│ sidebarTop  ActivityPage | SettingsPage>         │
│ (scrolls)│                                       │
│          │                                       │
│ ──────── │                                       │
│ sidebarBottom (fixed: version label + Settings)  │
└──────────┴──────────────────────────────────────┘
```

The sidebar uses two zones (`sidebarTop` = flex:1 overflow-y:auto, `sidebarBottom` = flex-shrink:0) so the Settings item is always visible regardless of zoom level.

---

## npm scripts

```bash
npm run dev          # Vite dev server + Electron (hot reload)
npm run dev:debug    # Same, but with DevTools auto-opened
npm run pack:mac     # tsc && vite build && electron-builder --mac
npm run pack:win     # tsc && vite build && electron-builder --win
npm run pack:all     # tsc && vite build && electron-builder --mac --win
```

**Note:** The build tool is `vite` (from `vite-plugin-electron`), NOT `electron-vite`. Do not use `electron-vite` in scripts.

---

## Coding conventions

1. **TypeScript strict** — no `any` without justification, no implicit `any`
2. **Null safety** — always guard array fields: `(s.toolsUsed ?? [])`, `(s.createdAt ?? '')`
3. **CSS Modules** — all component styles in `.module.css`, no inline styles for static values
4. **CSS variables** — never hardcode hex colours, always use `var(--tron-*)`
5. **Error boundaries** — `<PageErrorBoundary key={activePage}>` in App.tsx wraps all pages; add more where needed
6. **IPC guards** — wrap all `ipcMain.handle` bodies in try/catch, return safe defaults
7. **No Copilot file writes** — never write to `workspace.yaml`, `events.jsonl`, or any Copilot-owned file
