# Contributing to GridWatch

Thank you for your interest in contributing! GridWatch is a free, open-source desktop app and all contributions are welcome — bug fixes, features, documentation improvements, and design suggestions.

---

## Getting started

### 1. Fork and clone

```bash
git clone https://github.com/<your-username>/gridwatch.git
cd gridwatch
npm install
```

### 2. Run in development mode

```bash
npm run dev
```

This starts the Vite dev server and Electron together with hot reload. Use `npm run dev:debug` to open DevTools automatically.

### 3. Make your changes

See the project structure in [README.md](../README.md) to understand where things live.

---

## Development guidelines

### TypeScript

- All code must be TypeScript — no `.js` or `.jsx` files
- Strict mode is enabled — fix all type errors
- Use `import type` for type-only imports
- No `any` without a comment explaining why

### React

- Prefer React Server Components... actually, this is Electron — prefer functional components with minimal state
- Only add `'use client'`-equivalent patterns (hooks, events) where needed
- Keep components focused — split large components into smaller ones

### Styling

- Use CSS Modules (`.module.css`) for component styles
- Never use inline styles except for dynamic values (e.g., chart colours, widths computed from data)
- All colours must use CSS variables from `src/index.css` — do not hardcode hex values
- Mobile-first isn't relevant here, but ensure the layout works at different window sizes and zoom levels

### Electron / IPC

- All file system access must happen in the **main process** (`electron/main.ts`)
- Expose functionality to the renderer only through `contextBridge` in `preload.ts`
- Keep the `window.gridwatchAPI` surface minimal — one method per logical operation
- Never enable `nodeIntegration: true`

### Data

- GridWatch must **never modify** any Copilot-owned files (`workspace.yaml`, `events.jsonl`, etc.)
- Custom data (tags, settings) is stored in `gridwatch.json` per session dir or `localStorage`
- All reads are defensive — wrap file operations in try/catch and return safe defaults on failure

---

## Submitting a pull request

1. **Create a branch** from `main` with a descriptive name:
   ```bash
   git checkout -b feat/session-export
   git checkout -b fix/token-chart-scale
   ```

2. **Keep commits focused** — one logical change per commit with a clear message:
   ```
   feat: add CSV export for sessions
   fix: aggregate token chart data by day to avoid duplicate X positions
   docs: update README with new settings section
   ```

3. **Type-check before pushing**:
   ```bash
   npx tsc --noEmit
   ```

4. **Open a PR** against `main` with:
   - A clear description of what changed and why
   - Steps to test it manually
   - Screenshots if there are UI changes

---

## Reporting bugs

Use the [Bug Report](https://github.com/faesel/gridwatch/issues/new?template=bug_report.md) template. Please include:

- Your OS and version
- GridWatch version
- Steps to reproduce
- What you expected vs what actually happened
- Any relevant errors from DevTools console (`npm run dev:debug`)

---

## Requesting features

Open a [Feature Request](https://github.com/faesel/gridwatch/issues/new?template=feature_request.md) issue. Describe:

- The problem you're trying to solve
- Your proposed solution
- Any alternatives you considered

---

## Code of conduct

Be kind, constructive, and respectful. This project follows the [Contributor Covenant](https://www.contributor-covenant.org/) code of conduct.

---

## Questions?

Open a [GitHub Discussion](https://github.com/faesel/gridwatch/discussions) or reach out via [faesel.com](https://www.faesel.com).
