---
name: council-install
description: Install AI Council as a macOS application in /Applications so it appears in Spotlight, Launchpad, and the Dock. Use when the user wants to install the GUI as a standalone app or add it to their Applications folder.
license: MIT
metadata:
  author: ai-council
  version: "1.0"
---

# Council Install

Install AI Council as a macOS application.

## Installation

If `council` is not already installed, install it globally from NPM:

```bash
npm install -g @statechange/council
```

Or run commands directly with `npx @statechange/council`.

## When to Use

- The user wants to install AI Council as a macOS app
- The user wants AI Council in Spotlight, Launchpad, or the Dock
- The user asks to add the GUI to /Applications
- The user wants to uninstall AI Council from Applications

## Steps

### 1. Install the app

```bash
council install
```

This creates a lightweight `.app` wrapper in `/Applications/AI Council.app` that launches the Electron GUI.

### 2. Verify

The app should now be findable via Spotlight (Cmd+Space, type "AI Council") and visible in Launchpad.

### 3. Report to the user

Tell the user:
- AI Council is installed in /Applications
- They can find it in Spotlight or Launchpad
- They can drag it to the Dock for quick access

## Uninstall

To remove AI Council from Applications:

```bash
council install --uninstall
```

## Prerequisites

- Electron must be installed (`npm install -g electron`)
- The GUI must be built (`bun run build:gui` or `npm run build:gui`)
