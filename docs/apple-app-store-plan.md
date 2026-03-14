# Plan: Publish GridWatch to the Apple App Store

## Problem Statement

GridWatch is currently distributed as unsigned DMG files via GitHub Releases. To publish on the Mac App Store (MAS), we need to address code signing, App Sandbox compliance, Apple Developer account setup, entitlements, provisioning, and CI/CD automation.

### Key Findings from Codebase Audit

**Already in good shape:**

- Modern Electron 35.7.5 with `contextIsolation: true` and `sandbox: true`
- Hardened runtime enabled in electron-builder
- Universal binary support (arm64 + x64)
- `safeStorage` API for encrypted token storage
- Strong CSP and input validation
- App ID `com.faesel.gridwatch` is already MAS-compliant

**Gaps to close:**

- No MAS target in electron-builder config
- No entitlements files (`.plist`)
- No code signing certificates or provisioning profiles
- No notarisation setup
- No App Sandbox compliance (app reads `~/.copilot/` freely)
- No `pack:mas` npm script
- CI/CD has no signing or MAS build steps
- No App Store Connect listing or metadata

### Chosen Approach

- **Sandbox strategy:** Security-scoped bookmarks with an onboarding Open Panel dialog (guaranteed compliance, no temporary entitlement exceptions)
- **Distribution:** Mac App Store (MAS) target via electron-builder
- **CI/CD:** Extend existing GitHub Actions release workflow

---

## Phase 0 — Apple Developer Programme Setup (Manual, Outside Code)

- [ ] **Enrol in the Apple Developer Programme** ($99/year) at <https://developer.apple.com/programs/>. Required for all signing certificates and App Store Connect access.
- [ ] **Register App ID** `com.faesel.gridwatch` in the Apple Developer portal (Certificates, Identifiers & Profiles → Identifiers → App IDs). Enable any capabilities the app needs (currently none beyond default).
- [ ] **Create signing certificates** via Xcode or the Developer portal:
  - `3rd Party Mac Developer Application` — signs the app binary for MAS
  - `3rd Party Mac Developer Installer` — signs the `.pkg` installer for MAS upload
  - Export both as `.p12` files for CI/CD use.
- [ ] **Create MAS provisioning profile** for `com.faesel.gridwatch` in the Developer portal. Download the `.provisionprofile` file and commit it to the repo (e.g., `build/embedded.provisionprofile`).
- [ ] **Create App Store Connect listing:**
  - App name: GridWatch
  - Bundle ID: com.faesel.gridwatch
  - Category: Developer Tools
  - Screenshots (1280×800 and 1440×900 minimum)
  - Description, keywords, support URL, privacy policy URL
  - Age rating questionnaire
  - Pricing (Free)

## Phase 1 — Entitlements Files

- [ ] **Create `build/entitlements.mas.plist`** for the main app process:
  ```xml
  com.apple.security.app-sandbox = true
  com.apple.security.files.bookmarks.app-scope = true
  com.apple.security.files.user-selected.read-write = true
  com.apple.security.network.client = true
  ```
- [ ] **Create `build/entitlements.mas.inherit.plist`** for child/renderer processes:
  ```xml
  com.apple.security.app-sandbox = true
  com.apple.security.inherit = true
  ```
  Child processes inherit the parent's sandbox but need this minimal entitlements file.

## Phase 2 — App Sandbox Compliance (Security-Scoped Bookmarks)

- [ ] **Create bookmark storage module** (`electron/bookmark-store.ts`) that:
  - Persists security-scoped bookmark data to `app.getPath('userData')/bookmarks.json`
  - Provides `saveBookmark(path, bookmarkData)` and `loadBookmarks()` functions
  - Uses Electron's `app.getPath('userData')` which is always accessible inside the sandbox

- [ ] **Add first-run folder grant logic** in `electron/main.ts`:
  - On app launch, check if a valid bookmark for `~/.copilot` exists
  - If not, show a dialog explaining that GridWatch needs access to `~/.copilot/`
  - Open a native `dialog.showOpenDialog` pointed at `~/.copilot/` with `securityScopedBookmarks: true`
  - Store the returned bookmark data via the bookmark storage module
  - On subsequent launches, resolve the bookmark with `app.startAccessingSecurityScopedResource(bookmark)` before any file reads
  - Call `stopAccessingSecurityScopedResource()` on app quit

- [ ] **Create onboarding UI** — a minimal page/modal in the renderer:
  - Explains why folder access is needed
  - Has a "Grant Access" button that triggers the IPC call to `dialog.showOpenDialog`
  - Shows success state once access is granted
  - Only shown when bookmark is missing or invalid

- [ ] **Add MAS build detection guard** so bookmark/sandbox logic only activates in MAS builds:
  - Check `process.mas` (set by Electron in MAS builds) or use an environment variable
  - Non-MAS builds (DMG) continue to work exactly as before with direct file access

- [ ] **Wrap file access with bookmark helpers** — centralise `startAccessingSecurityScopedResource()` / `stopAccessingSecurityScopedResource()` calls in a helper used by all IPC handlers accessing `~/.copilot/`

## Phase 3 — Electron-Builder MAS Configuration

- [ ] **Add MAS target** to `electron-builder.json5`:
  ```json5
  mas: {
    entitlements: "build/entitlements.mas.plist",
    entitlementsInherit: "build/entitlements.mas.inherit.plist",
    provisioningProfile: "build/embedded.provisionprofile",
    hardenedRuntime: false,  // MAS uses sandbox instead
    gatekeeperAssess: false,
    type: "distribution",
  }
  ```

- [ ] **Add `pack:mas` npm script** to `package.json`:
  ```json
  "pack:mas": "npm run clean && tsc && vite build && electron-builder --mac mas"
  ```

- [ ] **Decide provisioning profile storage** — commit the `.provisionprofile` or inject via CI. Ensure `.p12` cert files are **never** committed (CI secrets only).

## Phase 4 — Code Signing & Notarisation for DMG (Non-MAS)

- [ ] **Configure notarisation** for the existing DMG build so direct-download users also get a signed, notarised app:
  - Use `@electron/notarize` or electron-builder's built-in `notarize` config
  - Requires Apple ID + app-specific password or App Store Connect API key
  - Add `afterSign` hook or electron-builder `notarize` block

- [ ] **Create `build/entitlements.mac.plist`** for the non-MAS DMG build:
  ```xml
  com.apple.security.cs.allow-jit = true
  com.apple.security.cs.allow-unsigned-executable-memory = true
  ```

## Phase 5 — CI/CD Pipeline Updates

- [ ] **Add MAS build job** to `.github/workflows/release.yml`:
  - Add a `release-mas` job on `macos-latest`
  - Import signing certificates from GitHub Secrets into the macOS Keychain
  - Run `npm run pack:mas`
  - Upload `.pkg` artifact

- [ ] **Configure GitHub Actions secrets:**
  - `CSC_LINK` — base64-encoded `.p12` certificate
  - `CSC_KEY_PASSWORD` — certificate password
  - `APPLE_ID` — Apple ID email (for notarisation)
  - `APPLE_APP_SPECIFIC_PASSWORD` — app-specific password
  - `APPLE_TEAM_ID` — Apple Developer Team ID
  - `PROVISIONING_PROFILE_BASE64` — base64-encoded provisioning profile (if not committed)

- [ ] **Add notarisation** to the existing `release-mac` job for DMG builds

- [ ] **Add App Store upload step** using `xcrun altool --upload-app` or the newer `xcrun notarytool` / Transporter CLI

## Phase 6 — App Store Review Preparation

- [ ] **Create a privacy policy page** (GitHub Pages or README section). Apple requires a privacy policy URL. GridWatch reads local files only and makes no network requests to third parties — the policy should be straightforward.

- [ ] **Prepare App Store review notes** explaining:
  - The app reads local Copilot CLI session data from `~/.copilot/`
  - Folder access is requested on first launch via Open Panel
  - No user data is collected or transmitted
  - The app requires GitHub Copilot CLI to be installed to show meaningful data

- [ ] **Capture App Store screenshots** at required resolutions:
  - 1280×800 (13" Retina display)
  - 1440×900 (optional, for larger displays)
  - Show sessions page, tokens page, activity page, skills page

- [ ] **Audit `shell.openExternal()` and `shell.showItemInFolder()` usage** — both are permitted in MAS apps but Apple may scrutinise them. Ensure URL validation is tight.

## Phase 7 — Testing & Submission

- [ ] **Test MAS build locally** with `npm run pack:mas`, install, and verify:
  - Onboarding flow correctly prompts for `~/.copilot/` access
  - All session/token/skill reading works after granting access
  - App functions correctly within the sandbox
  - `safeStorage` API still works in MAS sandbox
  - `shell.showItemInFolder()` and `shell.openExternal()` work

- [ ] **Test sandbox edge cases:**
  - What happens if the user denies folder access?
  - What happens if the bookmark becomes stale (e.g., folder moved)?
  - Does archiving sessions (moving to `session-state-archived/`) work within the bookmark scope?
  - Do skill enable/disable operations (moving between `skills/` and `skills-disabled/`) work?

- [ ] **Submit to App Store** — upload via Transporter or `xcrun altool`, then manage the review in App Store Connect.

---

## Notes & Considerations

- **Dual distribution**: Keep both DMG (GitHub Releases) and MAS (App Store) builds. The DMG version doesn't need sandbox compliance and can continue working as-is.
- **`process.mas` flag**: Electron sets `process.mas = true` in MAS builds — use this to conditionally enable sandbox/bookmark logic.
- **Bookmark scope**: When the user grants access to `~/.copilot/`, the security-scoped bookmark covers all subdirectories — so `session-state/`, `logs/`, `skills/`, etc. are all accessible.
- **safeStorage**: Should work fine in MAS sandbox as it uses the system Keychain, which is accessible to sandboxed apps.
- **Auto-updates**: MAS apps are updated through the App Store — remove or disable any custom auto-update logic if present (none was found in the audit).
- **Electron MAS quirks**: electron-builder's MAS target automatically strips non-MAS frameworks and applies the correct code signing. The `hardenedRuntime` flag should be `false` for MAS (sandbox replaces it).
- **Review timeline**: Apple's review typically takes 1–3 days but can take longer for first submissions. Budget time for potential rejections and resubmissions.
