import React, { useEffect, useState } from "react";
import { Text } from "ink";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { existsSync, mkdirSync, writeFileSync, chmodSync, rmSync, copyFileSync, symlinkSync } from "node:fs";

const APP_PATH = "/Applications/State Change Council.app";

interface Props {
  uninstall?: boolean;
}

export function InstallCommand({ uninstall }: Props) {
  const [status, setStatus] = useState<string>(
    uninstall ? "Removing State Change Council..." : "Installing State Change Council...",
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (uninstall) {
      // Also remove legacy name
      if (existsSync("/Applications/AI Council.app")) {
        try { rmSync("/Applications/AI Council.app", { recursive: true, force: true }); } catch {}
      }
      if (!existsSync(APP_PATH)) {
        setStatus("State Change Council is not installed in /Applications.");
        return;
      }
      try {
        rmSync(APP_PATH, { recursive: true, force: true });
        setStatus("State Change Council removed from /Applications.");
      } catch (err: any) {
        setError(`Failed to remove ${APP_PATH}: ${err.message}`);
      }
      return;
    }

    async function install() {
      const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
      const mainJs = resolve(pkgRoot, "dist-electron/main.js");

      if (!existsSync(mainJs)) {
        setError(
          `Could not find Electron entry point at ${mainJs}\n` +
            "Make sure the GUI has been built: bun run build:gui",
        );
        return;
      }

      // Find the Electron.app bundle
      let electronAppDir: string | null = null;

      // Method 1: project-local node_modules
      const localElectronApp = resolve(pkgRoot, "node_modules/electron/dist/Electron.app");
      if (existsSync(localElectronApp)) {
        electronAppDir = localElectronApp;
      }

      // Method 2: npm global modules
      if (!electronAppDir) {
        try {
          const npmRoot = execSync("npm root -g", { encoding: "utf-8" }).trim();
          const globalElectronApp = resolve(npmRoot, "electron/dist/Electron.app");
          if (existsSync(globalElectronApp)) {
            electronAppDir = globalElectronApp;
          }
        } catch {}
      }

      if (!electronAppDir) {
        setError(
          "Could not find Electron.app bundle. Install Electron with:\n\n" +
            "  npm install -g electron\n",
        );
        return;
      }

      const electronBin = resolve(electronAppDir, "Contents/MacOS/Electron");

      // Build the .app structure
      const contentsDir = resolve(APP_PATH, "Contents");
      const macosDir = resolve(contentsDir, "MacOS");
      const resourcesDir = resolve(contentsDir, "Resources");

      try {
        // Clean previous install
        if (existsSync(APP_PATH)) {
          rmSync(APP_PATH, { recursive: true, force: true });
        }

        mkdirSync(macosDir, { recursive: true });
        mkdirSync(resourcesDir, { recursive: true });

        // Copy icon if available
        const icnsPath = resolve(pkgRoot, "assets/icon.icns");
        if (existsSync(icnsPath)) {
          copyFileSync(icnsPath, resolve(resourcesDir, "icon.icns"));
        }

        // Info.plist
        const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key>
  <string>State Change Council</string>
  <key>CFBundleDisplayName</key>
  <string>State Change Council</string>
  <key>CFBundleIdentifier</key>
  <string>com.statechange.council</string>
  <key>CFBundleVersion</key>
  <string>1.0</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleExecutable</key>
  <string>council</string>
  <key>CFBundleIconFile</key>
  <string>icon</string>
</dict>
</plist>`;
        writeFileSync(resolve(contentsDir, "Info.plist"), plist);

        // Shell script launcher — we can't copy/hardlink the Electron binary
        // (breaks code signing), so we use a script that execs Electron with
        // our main.js. The menu bar name is set via Menu.setApplicationMenu()
        // in our main.ts instead.
        const launcher = `#!/bin/bash

# Source shell profile so nvm/PATH are available when launched from Finder
if [ -f "$HOME/.zshrc" ]; then
  source "$HOME/.zshrc" 2>/dev/null
elif [ -f "$HOME/.bash_profile" ]; then
  source "$HOME/.bash_profile" 2>/dev/null
elif [ -f "$HOME/.bashrc" ]; then
  source "$HOME/.bashrc" 2>/dev/null
fi

ELECTRON="${electronBin}"
MAIN_JS="${mainJs}"

if [ ! -f "$ELECTRON" ]; then
  osascript -e 'display alert "Electron not found" message "The Electron binary has moved. Reinstall with: council install" as critical'
  exit 1
fi

export COUNCIL_CWD="$HOME"
exec "$ELECTRON" "$MAIN_JS"
`;
        const launcherPath = resolve(macosDir, "council");
        writeFileSync(launcherPath, launcher);
        chmodSync(launcherPath, 0o755);

        // Remove legacy .app if present
        if (existsSync("/Applications/AI Council.app")) {
          try { rmSync("/Applications/AI Council.app", { recursive: true, force: true }); } catch {}
        }

        setStatus(
          "State Change Council installed to /Applications.\nYou can find it in Spotlight or Launchpad.",
        );
      } catch (err: any) {
        setError(`Failed to create ${APP_PATH}: ${err.message}`);
      }
    }

    install();
  }, []);

  if (error) {
    return <Text color="red">{error}</Text>;
  }

  return <Text color="green">{status}</Text>;
}
