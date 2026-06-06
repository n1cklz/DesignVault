import path from "node:path";
import { app, BrowserWindow, dialog, ipcMain, type OpenDialogOptions } from "electron";
import { VaultDatabase } from "./database";

let mainWindow: BrowserWindow | null = null;
let vault: VaultDatabase;

const isDev = process.env.DESIGNVAULT_PROD === "1" ? false : Boolean(process.env.VITE_DEV_SERVER_URL) || !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 940,
    minHeight: 620,
    title: "DesignVault",
    backgroundColor: "#ffffff",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    void mainWindow.loadURL("http://127.0.0.1:5173");
  } else {
    void mainWindow.loadFile(path.join(__dirname, "../index.html"));
  }
}

function registerIpc() {
  ipcMain.handle("vault:list", () => vault.listImages());

  ipcMain.handle("vault:import", (_event, paths: string[]) => vault.importImages(paths));

  ipcMain.handle("vault:choose-images", async () => {
    const options: OpenDialogOptions = {
      title: "Import images",
      properties: ["openFile", "multiSelections"],
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }],
    };
    const result = mainWindow ? await dialog.showOpenDialog(mainWindow, options) : await dialog.showOpenDialog(options);

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return vault.importImages(result.filePaths);
  });

  ipcMain.handle("vault:add-tag", (_event, imageId: number, tagName: string) => vault.addTag(imageId, tagName));
  ipcMain.handle("vault:remove-tag", (_event, imageId: number, tagId: number) => vault.removeTag(imageId, tagId));
  ipcMain.handle("vault:save-comment", (_event, imageId: number, body: string) => vault.saveComment(imageId, body));
  ipcMain.handle("vault:remove-image", (_event, imageId: number) => vault.removeImage(imageId));
}

app.whenReady().then(() => {
  vault = new VaultDatabase();
  registerIpc();
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
