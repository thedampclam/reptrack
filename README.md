# RepTrack

Counts workout reps from a camera using on-device pose detection (MediaPipe Pose). No video leaves the device.

## Install on a phone
Open `https://thedampclam.github.io/reptrack/` over HTTPS.
- **iPhone (Safari):** Share, then Add to Home Screen.
- **Android (Chrome):** Menu, then Install app (or press the Install app button on the page).

The app works offline after the first load.

## Publish updates
1. Edit the files.
2. Run `node tests/engine.test.js`. It must print `all engine tests passed`.
3. Raise the version in two places: `VERSION` in `sw.js` and `APP_VERSION` in `index.html`.
4. Commit and push to `main`. GitHub Pages redeploys in about a minute.

Installed copies show an "A new version is ready" bar on the next launch. Tap Update.

## Files
- `index.html`: interface, camera loop, history, tuning
- `engine.js`: rep counting and exercise auto-detect
- `library.js`: built-in workouts
- `asset-shim.js`, `mp/`: pose model and runtime (model files stored as base64 text)
- `sw.js`, `manifest.webmanifest`, `icons/`: installable app
- `tests/`: engine tests with synthetic poses
