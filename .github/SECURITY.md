# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |

Only the latest release of GridWatch receives security updates.

## Reporting a Vulnerability

If you discover a security vulnerability in GridWatch, **please do not open a public issue**. Instead, report it privately:

1. Go to the [Security Advisories](https://github.com/faesel/gridwatch/security/advisories) tab.
2. Click **"New draft security advisory"** and fill in the details.

Alternatively, email **faesel@outlook.com** with:

- A description of the vulnerability
- Steps to reproduce
- Any relevant logs or screenshots (redact sensitive data)

## What to Expect

- **Acknowledgement** within 72 hours of your report.
- **Status update** within 7 days with an initial assessment.
- **Fix or mitigation** as soon as reasonably possible, depending on severity.

If the vulnerability is accepted, we will:

- Work on a fix in a private branch
- Credit you in the release notes (unless you prefer anonymity)
- Publish a security advisory once the fix is released

If declined, we will explain why.

## Scope

This policy covers the GridWatch desktop application and its Electron main/preload processes. It does **not** cover:

- The Copilot CLI itself or its session data format
- Third-party dependencies (report those to the upstream maintainer)

## Best Practices for Users

- Keep GridWatch updated to the latest version.
- Do not run GridWatch with elevated privileges unnecessarily.
- Review MCP server configurations before enabling them.

Thank you for helping keep GridWatch secure.
