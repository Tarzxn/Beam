# Beam Cloud

A personal **Studio** (chat that can use tools) and a private **Crew** of specialists. Everything runs in your own GitHub Codespace with your own Ollama Cloud key. The Render service is only a small sign-in and relay page.

## What it can do

- **Choose the model** for Studio and for each Crew specialist. The list is fetched live from your Ollama key, so new cloud models show up without an update.
- **Effort slider** sets how hard the model thinks. High and Max also **review their own finished work** against your request and the tool results, then fix what they find (Model dialog → Self-review: Auto, Always or Off).
- **Approve everything** mode in the permission dropdown runs edits, commands, browser actions and connected-service writes without asking. Hard command blocks, Plan mode and privacy checkpoints still apply. Commands run with your Codespace's permissions, so keep unrelated secrets off that workspace.
- **Web research**: one tool runs up to four searches at once and reads the best pages. Search uses your Ollama key first, then free search.
- **Crew** runs queued tasks in the background. Up to three read-only (Plan mode) tasks can run side by side (Model dialog → Crew parallel research); anything that edits runs alone. Free Ollama plans run one cloud model at a time, so leave it at 1 there.
- Documents, spreadsheets, slides, PDFs, images, 3D/CAD models, a headless browser, MCP servers and Google Drive/Slides, all executing in the Codespace.

## What is in this folder

```
app.py                  Render web app: GitHub sign-in and relay to your Codespace
gunicorn.conf.py        server settings
render.yaml             Render deployment settings
requirements.txt        Render's Python dependencies
templates/              login and Studio/Crew pages
static/                 app.css, app.js (Studio and Crew), beam-models.js (model picker)
worker/                 everything that runs in the Codespace, plus its dependency list
tests/                  run with: python -m unittest discover
```

`app.py` zips `worker/*.py` into the worker kit when it starts. The bytes are the same on every build, so a Codespace only reinstalls its environment (a few minutes) after you change worker code. `runner.py`, `crew_daemon.py` and `setup.py` in `worker/` belong to the older remote-runner design and are not installed.

## Deploy on Render (Free plan)

1. Put this folder at the root of a GitHub repository (private is fine).
2. In Render choose **New → Blueprint** and select `render.yaml`, or create a **Python** web service by hand:
   - Build: `pip install -r requirements.txt && python app.py --prepare`
   - Start: `gunicorn app:app`
   - Health check: `/healthz`
3. In GitHub → Settings → Developer settings → OAuth Apps, create an app. Homepage is your Render URL; callback is `https://YOUR-APP.onrender.com/auth/callback`. Beam asks for `read:user` and `codespace` access only.
4. In Render → Environment set `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` and `BEAM_SESSION_KEY` (32+ random characters; the Blueprint generates it, keep it between deploys). Render supplies `RENDER_EXTERNAL_URL`; with a custom domain set `PUBLIC_URL` to its exact HTTPS origin and update the OAuth callback.
5. Redeploy. Until setup is complete the site shows what is missing instead of crashing.

The build needs an SSH client and downloads a checksum-verified GitHub CLI into `.tools`. Render needs no Ollama key, disk or database.

## Using it

1. Open your Render URL, **Continue with GitHub**, pick a Codespace you own and **Connect**. The first connection installs the worker, document/3D libraries and headless Chromium (several minutes). The Codespace needs Python 3, SSH and passwordless sudo, which the default Linux Codespace has.
2. **Open project** to use an existing folder under `/workspaces`, or create a Beam workspace.
3. **Settings → add your Ollama Cloud API key.** It is encrypted in the Codespace and never returned to the page.
4. Pick a model from the name beside the composer, choose an effort level, then work in **Studio** or assign tasks in **Crew**.

Free Codespace tip: choose the smallest 2-core machine.

## Leaving, storage and security

Background work is **off** by default. When every Beam tab has been gone for two minutes the worker saves task records, cancels active work and asks GitHub to stop the whole Codespace. Turn on **Settings → Allow background work** to keep going instead. Questions, approvals and privacy checkpoints still wait for you. After reconnecting, open the Codespace button to resume saved tasks.

| Information | Where |
| --- | --- |
| Messages, task events, Crew profiles, memory, drafts | `/workspaces/.beam-cloud/beam.sqlite3` in your Codespace |
| Ollama and integration credentials | Encrypted files in `/workspaces/.beam-cloud` |
| Project files and generated artifacts | The project folder under `/workspaces` |
| Worker environment | `/workspaces/.beam-cloud-runtime/<hash>/` |
| GitHub session | Encrypted HttpOnly cookie in your browser |

There are no Gists and no public worker ports. Each worker is bound to one GitHub account ID and reached over that account's authenticated Codespace SSH connection. Detected sensitive data (keys, ID numbers and similar patterns) pauses before anything goes to Ollama Cloud. Pattern checks cannot catch everything. Deleting a Codespace deletes its uncommitted files and Beam database, so commit your work.

**Google Drive/Slides:** create a Google OAuth *Web application* client, enable the Drive and Slides APIs, add your Google account as a test user and register `https://YOUR-APP.onrender.com/auth/google/callback` as the redirect URI. Import the client JSON in Beam's Google connection controls.

**MCP:** Streamable HTTP and stdio servers are supported. Stdio commands run in the Codespace.

## Troubleshooting

- Render Free sleeps after 15 idle minutes; the first visit can take about a minute. Saved work stays on the Codespace.
- Changing `BEAM_SESSION_KEY` signs everyone out but deletes nothing.
- Sign-in or CSRF errors usually mean `PUBLIC_URL` and the OAuth callback disagree. Use the exact same HTTPS origin.
- Worker setup failed: check the Codespace has storage, Python 3/venv, network access and passwordless sudo, then choose Connect again. Nothing ever falls back to running on your PC or on Render.
- A model says it is unavailable: your Ollama plan may not include it. Pick another in the model dialog.

## Tests

```
pip install -r requirements.txt -r worker/requirements-cloud.txt
python -m unittest discover
node tests/test_viewer.cjs     # needs Node.js; set VELARIS_TEST_PYTHON if your Python is not called "python"
```

CAD tests need `manifold3d`, search tests need `ddgs`, and the key-storage tests in `test_connections.py` expect Windows or `OLLAMA_API_KEY`; they report errors if those are missing.

## License

See `LICENSE`.
