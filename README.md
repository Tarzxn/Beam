# Beam Cloud

Personal Studio and a private Crew, using your GitHub Codespace and your own Ollama key. This is the small **Python runtime** deployment edition. The desktop app remains separate.

## Render settings

Upload these files to the root of your GitHub repository. Create a **Python** Web Service on Render's **Free** plan, or use New → Blueprint with `render.yaml`.

Build command:
```
pip install -r requirements.txt && python app.py --prepare
```

Start command:
```
gunicorn app:app
```

Health check: `/healthz`. Leave Root Directory blank if these files are at the repository root. This edition needs no Dockerfile.

## Sign-in setup

1. Register an OAuth App in GitHub → Settings → Developer settings → OAuth Apps.
2. Homepage: your Render URL. Callback: `https://YOUR-APP.onrender.com/auth/callback`.
3. In Render → Environment, add `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` from that OAuth App.
4. Add `BEAM_SESSION_KEY`: at least 32 cryptographically random characters. Render's Blueprint generates it automatically. For a manually created service, use Render's Generate option for the environment value. Keep it unchanged across redeploys, and never commit it to GitHub.
5. Redeploy. Missing setup now shows a useful page instead of crashing the server. The health endpoint can be running while sign-in still needs configuration.

`RENDER_EXTERNAL_URL` is provided automatically. For a custom domain, set `PUBLIC_URL` to its exact HTTPS origin and update the OAuth callback.

Each user signs in with GitHub, connects an owned Codespace, opens a project folder and adds their own Ollama API key in Settings. First connection installs the worker and generation libraries in that Codespace. A standard Linux Codespace with Python, SSH, available storage and passwordless sudo is required.

## What is in this folder?

```
app.py                 web app and connection relay
requirements.txt       Render's Python dependencies
gunicorn.conf.py       server settings
render.yaml            Render deployment settings
worker.zip             source kit installed in the Codespace
templates/             login and Studio/Crew pages
static/                one stylesheet and one JavaScript file
README.md
LICENSE
```

The worker kit contains the source modules for Studio, Crew, privacy checks, file/3D generation, browser and integrations. They execute in the Codespace. They are bundled together so the Render repository stays small; they have not been removed from the app. No desktop installers, development tests, browser profiles, app data or credentials are included here. The original reference ZIP supplied by the user was not used as a code source.

## Storage and background work

Files stay in the chosen Codespace project. Conversations, profiles, avatars, drafts and paused tasks are stored in `/workspaces/.beam-cloud/beam.sqlite3`. Credentials are encrypted in that private folder. No Gists are used. Deleting the Codespace deletes this data unless you back it up.

Background work is **off** by default. If all browser tabs disconnect, Beam saves task records and stops the whole Codespace after a two-minute reconnect window. Enable background work in Settings to let Studio and Crew continue. Use Leave for explicit pause/stop or background choices. Provider idle/usage limits still apply. Browsers provide a standard close-tab warning; custom leave choices are inside the app.

Detected sensitive data pauses before Ollama Cloud. You can explicitly allow those details or stop; local Ollama is unavailable here. Project commands have the user's Codespace permissions.

Google Drive/Slides: import a Google OAuth **Web application** client with `https://YOUR-APP.onrender.com/auth/google/callback` as its redirect URI. Enable the Drive and Slides APIs and configure your Google test users. Browser automation and both HTTP/stdio MCP run in the Codespace.

## Updating the previous deployment

Use a new Python service, or change the existing service's runtime if Render offers that setting. Use this folder's contents as the deployment root; earlier versions and the desktop code can remain in a separate repository or folder. Update GitHub's callback if the service URL changes. Keep the same session key to avoid unnecessary sign-outs. Your Codespace data is separate from the web deployment.

The web runtime's build checks its SSH client and downloads a checksum-verified official GitHub CLI into `.tools`. No project commands run on the visitor's PC or on Render. Render Free can sleep and has usage limits; enabled background jobs run on the Codespace while GitHub keeps it available.
