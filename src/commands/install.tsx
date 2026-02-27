import React, { useEffect, useState } from "react";
import { Text } from "ink";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { existsSync, mkdirSync, writeFileSync, chmodSync, rmSync } from "node:fs";

const APP_PATH = "/Applications/AI Council.app";

interface Props {
  uninstall?: boolean;
}

export function InstallCommand({ uninstall }: Props) {
  const [status, setStatus] = useState<string>(
    uninstall ? "Removing AI Council..." : "Installing AI Council...",
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (uninstall) {
      if (!existsSync(APP_PATH)) {
        setStatus("AI Council is not installed in /Applications.");
        return;
      }
      try {
        rmSync(APP_PATH, { recursive: true, force: true });
        setStatus("AI Council removed from /Applications.");
      } catch (err: any) {
        setError(`Failed to remove ${APP_PATH}: ${err.message}`);
      }
      return;
    }

    async function install() {
      // Install flow
      const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
      const mainJs = resolve(pkgRoot, "dist-electron/main.js");

      if (!existsSync(mainJs)) {
        setError(
          `Could not find Electron entry point at ${mainJs}\n` +
            "Make sure the GUI has been built: bun run build:gui",
        );
        return;
      }

      // Verify electron is available
      let electronPath: string | null = null;
      try {
        const { createRequire } = await import("node:module");
        const req = createRequire(import.meta.url);
        electronPath = req("electron") as unknown as string;
      } catch {
        // not installed locally
      }
      if (!electronPath) {
        try {
          electronPath = execSync("which electron", { encoding: "utf-8" }).trim();
        } catch {
          // not in PATH
        }
      }
      if (!electronPath) {
        setError(
          "The GUI requires Electron. Install it with:\n\n" +
            "  npm install -g electron\n",
        );
        return;
      }

      // Build the .app structure
      const contentsDir = resolve(APP_PATH, "Contents");
      const macosDir = resolve(contentsDir, "MacOS");
      const resourcesDir = resolve(contentsDir, "Resources");

      try {
        mkdirSync(macosDir, { recursive: true });
        mkdirSync(resourcesDir, { recursive: true });

        // Info.plist
        const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key>
  <string>AI Council</string>
  <key>CFBundleDisplayName</key>
  <string>AI Council</string>
  <key>CFBundleIdentifier</key>
  <string>com.statechange.council</string>
  <key>CFBundleVersion</key>
  <string>1.0</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleExecutable</key>
  <string>ai-council</string>
</dict>
</plist>`;
        writeFileSync(resolve(contentsDir, "Info.plist"), plist);

        // Launcher shell script
        const launcher = `#!/bin/bash
MAIN_JS="${mainJs}"

# Find electron binary
ELECTRON=""

# Method 1: npm global modules
if [ -z "$ELECTRON" ]; then
  NPM_ROOT=$(npm root -g 2>/dev/null)
  if [ -n "$NPM_ROOT" ] && [ -f "$NPM_ROOT/electron/dist/Electron.app/Contents/MacOS/Electron" ]; then
    ELECTRON="$NPM_ROOT/electron/dist/Electron.app/Contents/MacOS/Electron"
  elif [ -n "$NPM_ROOT" ] && [ -f "$NPM_ROOT/electron/cli.js" ]; then
    ELECTRON=$(node "$NPM_ROOT/electron/cli.js" --print-path 2>/dev/null || echo "")
  fi
fi

# Method 2: PATH
if [ -z "$ELECTRON" ]; then
  ELECTRON=$(which electron 2>/dev/null || echo "")
fi

if [ -z "$ELECTRON" ]; then
  osascript -e 'display alert "Electron not found" message "Install Electron with: npm install -g electron" as critical'
  exit 1
fi

exec "$ELECTRON" "$MAIN_JS"
`;
        const launcherPath = resolve(macosDir, "ai-council");
        writeFileSync(launcherPath, launcher);
        chmodSync(launcherPath, 0o755);

        setStatus(
          "AI Council installed to /Applications.\nYou can find it in Spotlight or Launchpad.",
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
