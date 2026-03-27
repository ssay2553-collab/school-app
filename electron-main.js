/* eslint-env node */
const { app, BrowserWindow, Menu, protocol, session } = require("electron");
const path = require("path");
const fs = require("fs");

let schoolId = process.env.SCHOOL_ID || "eagles";

try {
  const configPath = path.join(__dirname, "electron-school-config.json");
  if (fs.existsSync(configPath)) {
    const configData = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    if (configData.schoolId) {
      schoolId = configData.schoolId;
    }
  }
} catch (e) {
  console.warn("Failed to load electron-school-config.json:", e.message);
}

const schools = {
  afahjoy: { name: "Gilead App", backgroundColor: "#FFF9F0", authDomain: "afahjoy-7cc03.firebaseapp.com" },
  beano: { name: "Beano App", backgroundColor: "#fdecb5ff", authDomain: "beano-app-a9c38.firebaseapp.com" },
  morgis: { name: "Great Legacy", backgroundColor: "#FDF7FF", authDomain: "morgis-app.firebaseapp.com" },
  perfect: { name: "PEI End", backgroundColor: "#d3e6a1ff", authDomain: "clis-app-f89b8.firebaseapp.com" },
  IBS: { name: "IBS App", backgroundColor: "#ecfcb1ff", authDomain: "jei-river.firebaseapp.com" },
  creation: { name: "Creation Star", backgroundColor: "#FDF7FF", authDomain: "vince-app-c49a2.firebaseapp.com" },
  eagles: { name: "Adehyeemba", backgroundColor: "#e1b1f1ff", authDomain: "royal-lisben.firebaseapp.com" },
  kent: { name: "KIS App", backgroundColor: "#edeeb0ff", authDomain: "golden-rock-16bf8.firebaseapp.com" },
  bishops: { name: "Bishop App", backgroundColor: "#FAFAFA", authDomain: "thess-app.firebaseapp.com" },
  jewel: { name: "Jewel Star", backgroundColor: "#d671b8ff", authDomain: "jewels-app-17a30.firebaseapp.com" },
  clis: { name: "CLIS App", backgroundColor: "#96d494ff", authDomain: "clis-app-e39e8.firebaseapp.com" },
  model: { name: "Model Power", backgroundColor: "#FDF7FF", authDomain: "model-power-430de.firebaseapp.com" },
  stone: { name: "Stepping Stone", backgroundColor: "#f7f6d1ff", authDomain: "stepping-stone-90720.firebaseapp.com" },
  brain: { name: "Bright Brain", backgroundColor: "#FDF7FF", authDomain: "bright-brain-99daa.firebaseapp.com" },
  cascom: { name: "CASCOM App", backgroundColor: "#8aa3f5ff", authDomain: "cascom-59b61.firebaseapp.com" },
  bms: { name: "BMS App", backgroundColor: "#dce099ff", authDomain: "bms-app-f4572.firebaseapp.com" },
};

const selected = schools[schoolId] || schools.eagles;

protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, allowServiceWorkers: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

function createWindow() {
  const win = new BrowserWindow({
    width: 1350,
    height: 900,
    title: selected.name,
    backgroundColor: selected.backgroundColor,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // FORCE CLEAR STORAGE ON STARTUP (Fixes IBS stickiness)
  win.webContents.session.clearStorageData({
    storages: ['localstorage', 'cookies', 'cachestorage']
  }).then(() => {
    console.log("[Electron] Storage cleared to ensure fresh branding.");
  });

  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const { requestHeaders } = details;
    const url = details.url.toLowerCase();
    const isFirebaseRequest = url.includes('firebase') || url.includes('googleapis.com');
    
    if (isFirebaseRequest) {
      const origin = `https://${selected.authDomain}`;
      requestHeaders['Origin'] = origin;
      requestHeaders['Referer'] = origin + '/';
    }
    callback({ requestHeaders });
  });

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Access-Control-Allow-Origin': ['*'],
        'Content-Security-Policy': ["default-src * 'unsafe-inline' 'unsafe-eval'; script-src * 'unsafe-inline' 'unsafe-eval'; connect-src * 'unsafe-inline'; img-src * data: blob: 'unsafe-inline'; frame-src *; style-src * 'unsafe-inline';"]
      }
    });
  });

  Menu.setApplicationMenu(null);

  const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

  if (isDev && process.env.NODE_ENV === "development") {
    const url = process.env.EXPO_DEV_URL || "http://localhost:8081";
    win.loadURL(url).catch(() => {
      setTimeout(() => win.loadURL(url), 2000);
    });
  } else {
    win.loadURL("app://local/");
  }

  win.webContents.on("did-finish-load", () => {
    win.webContents.executeJavaScript(`window.isElectron = true;`);
    win.show();
  });
}

app.whenReady().then(() => {
  protocol.handle("app", async (request) => {
    const url = new URL(request.url);
    let relativePath = decodeURIComponent(url.pathname);
    if (relativePath.startsWith("/")) relativePath = relativePath.substring(1);
    if (relativePath.startsWith("local/")) relativePath = relativePath.substring(6);
    
    if (!relativePath || relativePath === "" || relativePath === "local" || relativePath === "/") {
      relativePath = "index.html";
    }

    const appPath = app.getAppPath();
    const distPath = path.join(appPath, "dist");
    let filePath = path.join(distPath, relativePath);

    if (!fs.existsSync(filePath)) {
      filePath = path.join(distPath, "index.html");
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = { ".js": "text/javascript", ".html": "text/html", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml" };

    try {
      return new Response(fs.readFileSync(filePath), {
        status: 200,
        headers: { "Content-Type": mimeTypes[ext] || "application/octet-stream" }
      });
    } catch (e) { return new Response("Not Found", { status: 404 }); }
  });

  createWindow();
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
