// IQvori – © 2026 Fabian Emmer
const { contextBridge, ipcRenderer } = require("electron");
const inv = (c, ...a) => ipcRenderer.invoke(c, ...a);
contextBridge.exposeInMainWorld("iq", {
  store: {
    load: () => inv("store-load"),
    saveMat: m => inv("store-save-mat", m),
    delMat: id => inv("store-del-mat", id),
    saveStats: s => inv("store-save-stats", s)
  },
  ai: req => inv("ai", req),
  aiCancel: id => ipcRenderer.send("ai-cancel", id),
  aiTest: () => inv("ai-test"),
  settings: { get: () => inv("settings-get"), set: p => inv("settings-set", p) },
  saveFile: (name, data) => inv("save-file", { name, data }),
  exportLib: () => inv("export"),
  importLib: () => inv("import"),
  openExternal: url => inv("open-external", url),
  openDataDir: () => inv("open-data"),
  update: {
    check: () => inv("update-check"),
    install: () => inv("update-install"),
    on: cb => ipcRenderer.on("update", (e, d) => cb(d))
  }
});
