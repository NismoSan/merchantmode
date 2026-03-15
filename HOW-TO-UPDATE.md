# How to Publish an Update

## Prerequisites

1. A GitHub personal access token with `repo` permissions.
   - Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Generate a new token with the `repo` scope
2. Set the token as an environment variable before running the build:
   ```
   set GH_TOKEN=ghp_your_token_here
   ```

## Steps

1. **Bump the version** in `package.json`:
   ```json
   "version": "1.0.1"
   ```
   Use [semver](https://semver.org/) — e.g. `1.0.1` for a patch, `1.1.0` for a feature, `2.0.0` for breaking changes.

2. **Build and publish**:
   ```
   set GH_TOKEN=ghp_your_token_here
   npm run dist
   ```
   This compiles the app, packages the Windows installer, and uploads it as a GitHub Release.

3. **Done.** All running copies of Merchant Mode will detect the new version within 30 minutes (or on next launch) and download it automatically. The update installs when the user closes the app.

## What Happens on the User's Side

- The app checks for updates on startup and every 30 minutes.
- If an update is found, it downloads silently in the background.
- When the download finishes, the update installs automatically the next time the app is closed.
- No action required from the user.

## Manual Update Check (from the app)

The renderer has access to these via `window.merchantMode.updater`:

| Method         | Description                              |
|----------------|------------------------------------------|
| `check()`      | Manually trigger an update check         |
| `install()`    | Quit the app and install the update now  |
| `getVersion()` | Returns the current app version string   |
| `onStatus(cb)` | Listen for update events (see below)     |

### Update Status Events

The `onStatus` callback receives an object with a `status` field:

| Status         | Extra Fields       | Meaning                          |
|----------------|--------------------|----------------------------------|
| `checking`     |                    | Checking GitHub for updates      |
| `available`    | `version`          | A new version was found          |
| `downloading`  | `percent`          | Download progress (0–100)        |
| `ready`        | `version`          | Downloaded and ready to install  |
| `up-to-date`   |                    | Already on the latest version    |
| `error`        | `message`          | Something went wrong             |

## Troubleshooting

- **Build fails with auth error** — Make sure `GH_TOKEN` is set and the token has `repo` scope.
- **Users don't get the update** — Verify the GitHub Release was created (check the repo's Releases page). The release must not be a draft.
- **Update downloads but doesn't install** — The NSIS installer applies on quit. If the user force-kills the app, the update may not apply until the next normal shutdown.
