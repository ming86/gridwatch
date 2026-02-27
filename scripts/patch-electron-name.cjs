#!/usr/bin/env node
// Patches the local Electron binary's Info.plist so the macOS dock tooltip
// shows "GridWatch" instead of "Electron" in development mode.
// Runs automatically via the "postinstall" npm script.

const fs = require('fs')
const path = require('path')

const plistPath = path.join(
  __dirname,
  '../node_modules/electron/dist/Electron.app/Contents/Info.plist',
)

if (!fs.existsSync(plistPath)) {
  console.log('patch-electron-name: Info.plist not found (non-macOS or not installed), skipping.')
  process.exit(0)
}

let content = fs.readFileSync(plistPath, 'utf-8')
content = content.replace(
  /(<key>CFBundleDisplayName<\/key>\s*<string>)[^<]*(<\/string>)/,
  '$1GridWatch$2',
)
content = content.replace(
  /(<key>CFBundleName<\/key>\s*<string>)[^<]*(<\/string>)/,
  '$1GridWatch$2',
)
fs.writeFileSync(plistPath, content, 'utf-8')
console.log('patch-electron-name: Electron Info.plist patched → GridWatch')
