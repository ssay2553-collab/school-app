/* eslint-env node */
const { app, BrowserWindow, Menu, protocol, session } = require("electron");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

let schoolId = process.env.SCHOOL_ID || "beano";

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
  eagles: { name: "Eagle Nest", backgroundColor: "#e1b1f1ff", authDomain: "royal-lisben.firebaseapp.com" },
  kent: { name: "KIS App", backgroundColor: "#edeeb0ff", authDomain: "golden-rock-16bf8.firebaseapp.com" },
  bishops: { name: "Bishop App", backgroundColor: "#FAFAFA", authDomain: "thess-app.firebaseapp.com" },
};

const selected = schools[schoolId] || schools.beano;

const BLOCKED_KEYWORDS = ["porn", "xxx", "adult", "sex", "nude", "bet", "casino"];

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

  // Intercept and fix headers for Firebase to prevent 400 Bad Request in Electron
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const { requestHeaders } = details;
    const url = details.url.toLowerCase();
    const isFirebaseRequest = url.includes('firebase') || url.includes('googleapis.com');
    
    // Safety filtering at network level
    if (BLOCKED_KEYWORDS.some(word => url.includes(word)) && !url.includes("bing.com")) {
      console.log("Blocking restricted URL:", url);
      return callback({ cancel: true });
    }

    if (isFirebaseRequest) {
      const origin = `https://${selected.authDomain}`;
      requestHeaders['Origin'] = origin;
      requestHeaders['Referer'] = origin + '/';
      
      requestHeaders['Sec-Fetch-Mode'] = 'cors';
      requestHeaders['Sec-Fetch-Site'] = 'cross-site';
      requestHeaders['Sec-Fetch-Dest'] = 'empty';
    }
    
    callback({ requestHeaders });
  });

  // Allow Framing for Bing search and other educational resources
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const { responseHeaders } = details;
    const url = details.url;

    // Strip frame restrictions for Bing to allow search to work in iframe
    if (url.includes("bing.com")) {
      Object.keys(responseHeaders).forEach(header => {
        if (header.toLowerCase() === 'x-frame-options' || header.toLowerCase() === 'content-security-policy') {
          delete responseHeaders[header];
        }
      });
    }

    callback({
      responseHeaders: {
        ...responseHeaders,
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
    win.webContents.executeJavaScript(`
      window.isElectron = true;
      if (!document.getElementById('electron-floating-nav')) {
        const nav = document.createElement('div');
        nav.id = 'electron-floating-nav';
        nav.style.position = 'fixed';
        nav.style.bottom = '25px';
        nav.style.left = '25px';
        nav.style.zIndex = '999999';
        nav.style.display = 'flex';
        nav.style.gap = '10px';
        
        nav.innerHTML = \`
          <button style="background:#1e293b;color:white;border:1px solid #334155;padding:8px 16px;border-radius:12px;cursor:pointer;font-size:11px;font-weight:900;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1)" onclick="window.history.back()">← BACK</button>
          <button style="background:#ef4444;color:white;border:none;padding:8px 16px;border-radius:12px;cursor:pointer;font-size:11px;font-weight:900;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1)" id="electron-exit-hub">EXIT TO HUB</button>
        \`;
        document.body.appendChild(nav);
        
        document.getElementById('electron-exit-hub').addEventListener('click', () => {
          window.location.href = "/";
        });

        function syncNav() {
          const isHome = window.location.pathname === '/' || window.location.pathname === '/index.html' || window.location.href.endsWith('/');
          nav.style.display = isHome ? 'none' : 'flex';
        }
        setInterval(syncNav, 1000);
        syncNav();
      }
    `);
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
    const mimeTypes = { ".js": "text/javascript", ".html": "text/html", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ttf": "font/ttf", ".woff": "font/woff", ".woff2": "font/woff2" };

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
