# Beam Cloud 0.8.0 validation — 2 November 2026

The automated regression run passed **224 tests**: existing agent, document/CAD, privacy, Crew and desktop behaviour, plus 16 cloud-web tests. Three existing desktop tests requiring Windows loopback networking (two Google callback tests and the Windows asyncio/MCP configuration test) were excluded in this restricted session. Their loopback prerequisites were blocked; they are not reported as passes. The cloud Google web flow has separate PKCE/state/cancellation coverage without loopback sockets.

Cloud checks verify:

- GitHub OAuth state/PKCE, encrypted HttpOnly sessions, forged/anonymous session rejection and CSRF/origin checks.
- Codespace ownership validation, independent account/connection routing and no Gist scope.
- A persistent SSH handshake, bootstrap readiness, stdin-only credentials and absence of Render/Ollama secrets from the GitHub helper's environment.
- Worker account binding, project path confinement, existing repository editing and rejection of desktop/remote-switch/local-Ollama routes.
- Encrypted credentials, database re-opening, durable conversations, avatars, drafts and UI preferences.
- Background work off by default, multiple browser tabs, enabled-background behaviour, saved pause records before shutdown and a Studio task finishing a real file without a live web request.
- Sensitive prompts pausing before any model call, only cloud/stop choices and no silent local/cloud fallback.

The installed Chrome browser was exercised against an offline request harness that forwards browser requests through the real Flask gateway, Codespace service and database. External GitHub/Ollama responses are fixtures. It verified login, account display, Codespace selection, browsing an existing repository, file creation and preview in Studio, a completed Crew file task, cloud-only privacy controls, saved drafts, explicit background opt-in and Studio/Crew navigation. Zero JavaScript errors and no duplicate DOM IDs are required. Desktop and mobile screenshots were inspected; the cloud stylesheet adds mobile navigation drawers while preserving the desktop interface.

Python modules compile, cloud JavaScript passes syntax checks, and the generated worker kit is checked for ZIP integrity and source-only content. The Render archive excludes local databases, browser profiles, saved settings, credentials, caches and Windows binary helpers. The Docker build context uses an explicit source/asset allowlist. The gateway's log format omits URL queries so OAuth authorization codes do not enter its access log.

**Not verified live:** a Docker image build (no Docker runtime is installed on this Windows host), Render deployment/cold-start behaviour, a real GitHub OAuth application and user authorization, Codespace SSH provisioning, Linux package/Chromium installation, real provider shutdown or Google account authorization. These require the host's OAuth configuration and a live Codespace. The package includes setup instructions; it is deployment-ready source, not a claim that a hosted instance has already been deployed.

The Codespace worker uses private Unix sockets, an account ownership record and a lifetime process lock. Its real Unix-socket lifecycle and Linux process permissions still require the live Linux validation described above. Authorized tool commands use the user's Codespace account; bot-specific OS isolation is not provided. Privacy detection is heuristic. Deleting a Codespace removes its Beam data unless separately backed up. Existing desktop Cloud Crew data is preserved separately; desktop/cloud synchronization and automatic historical migration are not included.
