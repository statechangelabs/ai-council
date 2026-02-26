import { app, BrowserWindow, ipcMain, protocol, net } from "electron";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { appendFileSync, writeFileSync } from "node:fs";
import { registerIpcHandlers } from "./ipc-handlers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const logFile = join(__dirname, "..", "electron-debug.log");

function log(source: string, ...args: unknown[]) {
  const line = `[${new Date().toISOString()}] [${source}] ${args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ")}\n`;
  appendFileSync(logFile, line);
}

// Clear log on startup
writeFileSync(logFile, `=== AI Council Electron — started ${new Date().toISOString()} ===\n`);

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  log("main", "Creating BrowserWindow");

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: "AI Council",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(__dirname, "preload.mjs"),
    },
  });

  // Capture renderer console messages
  mainWindow.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    const levelName = ["DEBUG", "INFO", "WARN", "ERROR"][level] || "LOG";
    log(`renderer:${levelName}`, `${message} (${sourceId}:${line})`);
  });

  // Capture renderer crashes
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    log("main:CRASH", "Renderer process gone:", details);
  });

  // Capture page errors
  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription) => {
    log("main:LOAD_ERROR", `Failed to load: ${errorCode} ${errorDescription}`);
  });

  const url = process.env.VITE_DEV_SERVER_URL;
  if (url) {
    log("main", `Loading dev server URL: ${url}`);
    mainWindow.loadURL(url);
  } else {
    const filePath = join(__dirname, "../dist-renderer/index.html");
    log("main", `Loading file: ${filePath}`);
    mainWindow.loadFile(filePath);
  }

  // Open DevTools in dev mode
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Register custom protocol to serve local files (file:// is blocked when loaded via http dev server)
protocol.registerSchemesAsPrivileged([
  { scheme: "council-file", privileges: { bypassCSP: true, supportFetchAPI: true } },
]);

app.whenReady().then(() => {
  log("main", "App ready, registering IPC handlers");

  // Handle council-file:// URLs by mapping them to local files
  protocol.handle("council-file", (request) => {
    const filePath = decodeURIComponent(request.url.replace("council-file://", ""));
    return net.fetch(pathToFileURL(filePath).href);
  });

  registerIpcHandlers(ipcMain, () => mainWindow);
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
