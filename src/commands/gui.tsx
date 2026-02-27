import React, { useEffect, useState } from "react";
import { Text } from "ink";
import { spawn, execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { existsSync } from "node:fs";

export function GuiCommand() {
  const [status, setStatus] = useState<string>("Locating Electron...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function launch() {
      // Resolve dist-electron/main.js relative to this package
      const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
      const mainJs = resolve(pkgRoot, "dist-electron/main.js");

      if (!existsSync(mainJs)) {
        setError(
          `Could not find Electron entry point at ${mainJs}\n` +
            "Make sure the GUI has been built: bun run build:gui",
        );
        return;
      }

      // Try to find the electron binary
      let electronPath: string | null = null;

      // Method 1: require.resolve("electron") — the npm package exports the binary path
      try {
        const { createRequire } = await import("node:module");
        const require = createRequire(import.meta.url);
        electronPath = require("electron") as unknown as string;
      } catch {
        // not installed locally
      }

      // Method 2: check PATH
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

      // Spawn electron as a detached process so the CLI can exit
      setStatus("Launching AI Council GUI...");
      const child = spawn(electronPath, [mainJs], {
        detached: true,
        stdio: "ignore",
      });
      child.unref();

      // Give it a moment then exit
      setTimeout(() => process.exit(0), 500);
    }

    launch();
  }, []);

  if (error) {
    return <Text color="red">{error}</Text>;
  }

  return <Text>{status}</Text>;
}
