# Websites inside the study phone

This optional Electron desktop host runs websites in a sandboxed `WebContentsView` positioned inside the study phone. Sites such as Chess.com load as browser pages rather than cross-origin iframes. Selecting **Website inside phone** does not open another window. Ordinary browsers such as Opera continue using iframe mode and remain subject to website framing policies.

## Start

1. Start the configured backend normally (`npm run dev` in `backend`).
2. Start the frontend (`npm run dev` in `frontend`, normally http://localhost:3000).
3. In this `desktop` directory, run `npm install` once, then `npm start`.
4. Sign in, open the study phone with **Alt+P**, choose its browser or a website shortcut, and enter an HTTPS address such as `https://www.chess.com`. Use **Website inside phone** mode.

Node.js and npm are required. The desktop package installs the current Electron release; keep it updated because it runs remote websites. Existing backend/database configuration is still required. No desktop installer or bundled backend is included.

For a hosted app, set `ASSIGNMENT_TRACKER_URL` to its HTTPS URL before running `npm start`. In PowerShell: `$env:ASSIGNMENT_TRACKER_URL='https://your-app.example'`. Only HTTPS app URLs and localhost HTTP development URLs are accepted. Use only a trusted deployment: that origin receives the restricted desktop bridge.

## Behavior and limits

- Native tabs follow phone resizing, dragging, hiding and app switching. Inactive tabs retain their pages; closing, suspending or disabling the phone destroys their browser views. Saved sessions restore addresses and wait for Resume.
- Back/forward follows actual website navigation; zoom changes the native browser zoom. Fixed viewport and iframe compatibility settings apply only to the web version.
- Website cookies persist on this machine in a separate partition per Assignment Tracker account. Signing out closes native views but retains website cookies for the next sign-in. A full account reset clears that account's website cookies and cache on this device.
- External HTTPS pages run with sandboxing, context isolation, web security and no Node.js or app bridge. Navigation to the app origin, local files and non-HTTPS schemes is denied. Camera, microphone, other device permissions and downloads are disabled.
- Website requests for another window navigate the current phone tab instead. Services requiring special pop-ups, OAuth, DRM, unsupported permissions or an approved browser may still refuse access. Website compatibility and Chess.com sign-in have not been verified.
- Alt+P works while the native website has keyboard focus. App shortcuts otherwise belong to the app when its interface has focus; websites receive typing while their view is focused.
- Explicit **Open in browser** links still launch the system browser. Choosing native phone mode avoids that external workflow.

Implementation reference: [Electron WebContentsView](https://www.electronjs.org/docs/latest/api/web-contents-view).
