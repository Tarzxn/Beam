# Beam Cloud 0.8.0

The web edition of Beam: a personal **Studio** and a private **Crew** of specialists, using the desktop app's interface and file/3D generation tools.

Sign in with GitHub, connect your own Codespace, open its project folders and add your own Ollama Cloud API key. Files, conversations, settings, team profiles, credentials and paused tasks are stored in your Codespace. Render hosts a lightweight authenticated gateway. No Gists or PC command runner are used.

**Start here: [CLOUD_SETUP.md](CLOUD_SETUP.md).** It explains GitHub OAuth registration, Render Free deployment, the first Codespace connection, Google Slides setup and background work.

Deployment files are ready at the repository root:

- `render.yaml`: a Free Render Docker web service and environment settings.
- `Dockerfile`: small gateway image with a verified GitHub CLI download.
- `cloud_app.py`: the Gunicorn entry point.
- `requirements-cloud.txt`: lightweight Render dependencies.
- `cloud_worker.py`, `cloud_runtime.py`: private Codespace service and state.

Background work is off by default. When the browser disconnects, the worker saves resumable task records and stops the Codespace after a two-minute grace period. Enable background work in Settings to let Studio and Crew continue independently. GitHub's own usage and lifecycle limits still apply.

The Windows application has been kept. Its source entry point remains `desktop.py`; existing EXE installers are separate and unchanged. This cloud ZIP omits desktop binary helpers and generated data. Original desktop documentation is included as `DESKTOP_README.md`.

See [CLOUD_VALIDATION.md](CLOUD_VALIDATION.md) for tested behaviour and the external deployment checks that still require the host's accounts.
