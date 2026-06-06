import { contextBridge, ipcRenderer, webUtils } from "electron";
import type { DesignVaultApi } from "../shared/types";

const api: DesignVaultApi = {
  listImages: () => ipcRenderer.invoke("vault:list"),
  importImages: (paths) => ipcRenderer.invoke("vault:import", paths),
  chooseImages: () => ipcRenderer.invoke("vault:choose-images"),
  addTag: (imageId, tagName) => ipcRenderer.invoke("vault:add-tag", imageId, tagName),
  removeTag: (imageId, tagId) => ipcRenderer.invoke("vault:remove-tag", imageId, tagId),
  saveComment: (imageId, body) => ipcRenderer.invoke("vault:save-comment", imageId, body),
  removeImage: (imageId) => ipcRenderer.invoke("vault:remove-image", imageId),
  getDroppedFilePath: (file) => webUtils.getPathForFile(file),
};

contextBridge.exposeInMainWorld("designVault", api);
