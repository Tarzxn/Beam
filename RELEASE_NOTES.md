# Beam Cloud 0.8.0 — web edition

- Separate Render Free gateway with GitHub OAuth sign-in, private account ownership and per-user Codespace connections. Desktop entry points and installers are retained.
- Studio and Crew execute in the Codespace, with their shared database, encrypted credentials, drafts and resumable task records stored there. Existing repository folders can be opened directly.
- Background work is opt-in. An independent Codespace watchdog saves tasks and stops the machine after a disconnected-browser grace period when background work is off.
- Cloud browser, Web OAuth for Google Slides/Drive, MCP and file/3D generation retain the desktop interface. Privacy checks offer explicit cloud consent or stop; local Ollama and PC execution controls are removed from the web flow.
- Docker/Render configuration, source-only packaging, deployment instructions and cloud isolation/lifecycle/browser checks are included. Live deployment and account provisioning require the host's configuration.

# Beam 0.7.0

- Reworked This PC / Codespaces switching: the chooser appears immediately, slow GitHub discovery no longer blocks it, and idle background polling has been removed.
- The last Codespace is remembered for one-click return. PC and cloud Studio views keep separate drafts, transcripts and activity instead of being cleared during a switch.
- Codespace activation now establishes one remote connection and returns its first file listing in the same request, with a clear in-app transition and guarded controls while it completes.
- Added regression coverage for activation request count, delayed discovery, saved targets, view restoration and idle network activity.

# Beam 0.6.0

- Studio replaces the Code label; a sidebar switch moves between personal work and Crew. Crew keeps the warm palette with simpler navigation and task layouts.
- Per-project This PC / GitHub Codespaces execution choice; both use Ollama Cloud. Bundled browser-based GitHub login, worker installation, explicit file transfer, stop/resume and idle controls.
- Optional persistent Cloud Crew coordinator over SSH, with explicit remote credential consent, durable histories, ownership checks and no local execution fallback. Subject to GitHub limits.
- Member characters with ten shapes, colour/face controls and cropped uploads; job presets and editable instructions/memory.
- Honest working states during questions, approvals, privacy waits and disconnection. Sensitive text requires review before transfer; desktop private summaries never enter cloud model context.
- Existing enhanced document/CAD generation, previews, local integrations, effort settings and per-user uninstall remain available.

Cloud browser/MCP, persistent servers, automatic file synchronization, avatar image synthesis and unlimited always-on hosting are not included. Live GitHub/Codespace authentication and provisioning still need the user's account.

# Beam 0.5.0

- Added privacy checkpoints before cloud model transmission: local Ollama summaries, explicit per-run cloud consent for detected details, or cancellation. Cloud coding receives redacted context after local processing; local summaries remain separate from model context and team handoffs.
- Local privacy processing rejects cloud aliases/remote-backed models and uses fixed loopback transport without redirects or environment proxies. Common-pattern detection plus explicit private blocks covers prompts and tool results.

- Added Crew beside Code: persistent specialist profiles, per-bot memory, shared project briefs and separate task conversations.
- Lead delegation creates real bounded team tasks. Results return for synthesis; pending questions and approvals remain visible.
- Shared project scheduling prevents Crew and Code from editing the same workspace at once. Crew queues tasks, inherits permission/effort settings and supports stopping a whole delegated task tree.
- Task board, role editor, shared activity and live task view distinguish active work from queue/team/user waits. Interrupted runs remain available for review after a restart.
- Existing Code, file generation, 3D, browser, Google Slides and MCP features remain available.

Crew uses the current computer. Remote execution is a separate future feature. The installer remains per-user and supports Windows Installed apps → Uninstall while preserving projects and app data.

# Beam 0.4.0

- Live Working animation with phase/elapsed time while a real backend task runs. Separate approval, reply, stopping, finished, failed, interrupted and disconnected states; sidebar follows actual activity.
- Structured questions pause the agent and offer optional answer choices. Unexpected worker setup failures are finalized rather than left working.
- Generation cancellation before publication discards staged files. Reopened content checks, quality/checksum sidecars and inspect_artifact/artifact_help tools.
- Native Office content previews, A4/Letter documents, spreadsheet formula/chart checks, configurable presentation theme/branding and process slides; slide canvas bounds checked.
- Explicit model units and dimension/component constraints; no silent size correction. Better curve quality, sharp GLB creases and material support.
- Measured PNG/SVG view sheets, assembly BOMs and print-oriented parts. Added lidded enclosure and planter presets.

Beam remains text-only. File/geometry checks do not replace native layout review or manufacturing review.
