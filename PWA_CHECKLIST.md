PWA Checklist for EduEaz

What is already configured

- `app.config.js` contains a `web.pwa` block that defines:
  - `name`, `shortName`, `description`, `themeColor`, `backgroundColor`, `display: "standalone"`, `orientation: "any"`, `icon`, and `startUrl`.
  - This will be used by `npx expo export --platform web` to generate the web manifest and PWA assets when you run the web export.
- `package.json` has `build:web` which runs `npx expo export --platform web`.

What I added

- `serve:web` npm script in `package.json` to serve the exported web build with `npx serve web-build -l 8080`.
- This makes it easy to test the PWA locally after running the export.

Recommended checks to ensure a good PWA

1. Build and inspect generated artifacts
   - Run:
     ```powershell
     npm run build:web
     npm run serve:web
     ```
   - Open http://localhost:8080 in a browser.
   - In DevTools > Application > Manifest, confirm fields (name, icons, start_url, display) look correct.
   - Check that `/manifest.json` and `/service-worker.js` (or a generated SW) exist in the output folder (`web-build`).

2. Verify meta tags and icons
   - The Expo export should generate a `manifest.json` using `web.pwa` from `app.config.js`, and icons derived from the app icon. Confirm icons for multiple sizes are present under `web-build`.
   - In DevTools > Application > Service Workers, check the service worker registration and its scope.

3. Offline/Reload test
   - In DevTools > Network, set "Offline" and reload the page to confirm the app shell loads from cache and the offline experience is acceptable.

4. Platform checks
   - Add to home screen on Android (Chrome) and verify the app opens as a standalone app.
   - On iOS Safari, confirm splash screen and home screen behaviour; note that iOS handles PWAs differently (some settings are read from meta tags). If needed, add `web/index.html` with Apple meta tags to fine-tune iOS behaviour.

Optional improvements (low-risk)

- Add a small `web/manifest.webmanifest` template and a `web/service-worker.js` fallback to support custom SW behaviour for development. Expo generates these on export, but having templates may make it easier to tune.
- Add `web/index.html` with additional meta tags for iOS (apple-mobile-web-app-capable, apple-mobile-web-app-status-bar-style) if you need better iOS PWA UX.

If you want, I can:

- Update `app/index.tsx` to register the service worker on web (safe code path: only runs on web and only if navigator.serviceWorker is available).
- Run `npm run build:web` and `npm run serve:web` here and report the generated manifest & service worker files.

Note: starter templates were added to `web/` in this repo: `web/manifest.webmanifest`, `web/service-worker.js`, and `web/offline.html`. Use these as a base for local testing (they can be copied to the exported `web-build` folder or used by your static host).

Next step: tell me which optional improvements you'd like me to implement (add templates, register SW in code, or run an export now).
