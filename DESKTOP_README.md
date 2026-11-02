# Beam desktop — 0.7.0

A Windows desktop coding and file-generation agent using Reflection Beam on Ollama Cloud. Built from the supplied Velaris project. Beam is the temporary product name.

The separate **Beam Cloud** web edition keeps Studio and Crew, uses GitHub sign-in and runs project work exclusively in the user's Codespace. Its Render Free deployment uses `cloud_app.py`, `Dockerfile` and `render.yaml`. See [CLOUD_SETUP.md](CLOUD_SETUP.md). The desktop entry point and Windows installer sources remain available.

## Install and uninstall

1. Run `Beam-Setup-0.7.0.exe` and follow the setup wizard. It installs for the current Windows user without requiring administrator rights.
2. Launch Beam from the Start menu (an optional desktop shortcut is available).
3. In Settings, add your Ollama Cloud API key. Open a project folder and start a session.
4. To remove the app, go to Windows Settings → Apps → Installed apps → Beam → Uninstall. The Start menu also includes Uninstall Beam.

Program files are installed under `%LOCALAPPDATA%/Programs/Beam` by default. Sessions, encrypted settings and WebView data live separately in `%LOCALAPPDATA%/Beam`. Uninstall removes installed program files, shortcuts and the Windows uninstall entry. It preserves project folders and app data. Reinstalling or upgrading reuses that data.

To migrate the original portable build, open Settings → Import portable history, then select its `BeamData` folder (or the Beam folder containing it). This imports session history and existing protected key settings and backs up current history first. Projects stay in their original locations. Stop tasks and disconnect Cloud Crew before importing.

Windows 10/11 x64 is required. The installer includes Python and the generation libraries. It detects Microsoft's WebView2 Runtime and includes Microsoft's signed bootstrapper to install it when missing; that step requires an internet connection. Coding projects still use their own installed Python/Node/Git tools as appropriate. Git is optional for repository inspection. The setup file is unsigned.

Ollama Cloud uses the direct model ID `beam`; the local CLI alias is `beam:cloud`. Local Ollama or downloaded model weights are not required by Beam itself. Ollama controls model availability and usage limits. Its temporary free offer is not a promise of permanent unlimited access.

## Choose the project computer

Use **Project computer** in the top bar. Each project chooses either **This PC** or **GitHub Codespaces**. Both use the `beam` model on Ollama Cloud. This changes where commands execute and files are created, rather than where the coding model runs.

The computer chooser opens immediately while GitHub details load in the background. Beam remembers the last Codespace, provides a one-click return, and keeps separate Studio conversations and drafts for the PC and cloud workspace. A visible transition confirms the change without blanking the workspace or repeatedly polling GitHub while idle.

- **This PC** is the default. It preserves local project files, shell commands, the dedicated browser, Google integration, MCP and managed development servers. Beam must remain open for local work.
- **GitHub Codespaces** runs file tools, finite shell commands and file/CAD generation in a separate managed Linux folder. There is no fallback to executing commands on the PC when the connection fails. Public web search/page reading work; desktop browser/MCP and persistent servers are unavailable remotely. Studio still requires Beam open.
- **Cloud Crew**, enabled separately for a Codespace, runs the team coordinator and persists conversations there. Closing the desktop does not cancel these jobs. Approvals, private-model requests and essential questions pause until you return. After GitHub stops/restarts the machine, unfinished jobs are marked interrupted for review and manual resumption.

Connect GitHub through browser sign-in, choose a Codespace, select **Install worker**, then **Use Codespace**. Beam includes the official GitHub CLI helper; no terminal commands or local helper installation are needed. The worker uses a separate unprivileged `beamtask` command account. Setup requires a standard Linux Codespace with SSH, Python and passwordless sudo for the service user. See [GITHUB_SETUP.md](GITHUB_SETUP.md).

Cloud Crew needs explicit consent to store your Ollama API key and GitHub token on that Codespace. They are outside task directories in an owner-only folder and never included in model context. Disconnect Cloud Crew to remove its credential copies when no other project uses them. Use a Codespace dedicated to Beam. A Codespace is a separate computer, not a separate security boundary per teammate. Trusting commands authorizes arbitrary task execution under that account; simple command checks are not a complete security sandbox.

A private GitHub personal Free account currently includes 120 core-hours and 15 GB-month of storage, roughly 60 running hours on a two-core machine. GitHub can stop the computer for inactivity, at its 12-hour session maximum, or when the allowance is exhausted. Beam's optional five-minute stop saves idle hours and also stops other processes there. Stopped machines still consume storage allowance. Review your actual [GitHub allowance](https://docs.github.com/en/billing/concepts/product-billing/github-codespaces) and [lifecycle limits](https://docs.github.com/en/codespaces/about-codespaces/understanding-the-codespace-lifecycle). No payment details are required for using the included personal allowance; service eligibility and account policies may vary.

PC and cloud folders are separate. Existing files only upload after you review and confirm the list. Switching back returns to the original PC folder; it does not copy results. Use **Save a copy** to download cloud files. Finish active jobs before switching; disconnect Cloud Crew first. Local and Cloud Crew histories are retained separately on their respective computers.

Before sensitive prompt/profile text transfers from the PC to Codespaces, Beam asks for explicit transfer consent. Cancel and choose This PC to keep that input on the PC. Material already stored/generated in a Codespace is already on GitHub’s computer. Privacy checkpoints there protect subsequent Ollama model requests; they cannot undo that storage. Local summaries are produced on the desktop, stored only there and never returned to Codespaces or added to model context. Detection is pattern-based and does not catch every possible secret.

## Privacy checkpoints and local Ollama

Coding and tool planning still use Beam on Ollama Cloud. Before each model request, Beam scans the complete outgoing model context for common sensitive patterns: IP addresses, email addresses, credential values, API tokens and explicitly private text. Requests such as “what is my IP address?” pause before cloud planning so you can choose how their private results should be handled. Both Studio and Crew show a privacy checkpoint without a Working animation while waiting.

Choose **Use local Ollama** to summarize detected private excerpts on this computer. Beam replaces those values with placeholders before sending coding context to the cloud. The local summary is shown separately in a collapsed chat card; it is never inserted into cloud context or passed to another Crew bot. Coding continues on the cloud model. You may need to supply private configuration locally when an exact value is essential; Beam does not silently insert it into cloud-generated commands.

Choose **Allow cloud for these details** to authorize the currently detected values for this run. New private values require another choice. **Stop task** cancels the request. A missing or failed local model never causes an automatic switch to cloud processing.

In Settings, start/refresh local Ollama and select a downloaded model for private analysis. The connection is fixed to `127.0.0.1:11434`, ignores environment proxies and does not follow redirects. Beam checks installed-model metadata and rejects cloud aliases or remote-backed models before sending private excerpts. Local weights are not bundled or downloaded automatically. Ollama must be running, with a suitable local chat model installed.

Detection is best effort and cannot identify every kind of personal information. Wrap any other private material in `[private]...[/private]`, or put it on a `Private:` line, to force protection while leaving safe instructions outside the marked section. Model history, prompts and local results are stored on this computer; this feature controls model transmission rather than encrypting the entire history database. Public documentation IP ranges and loopback examples are excluded from automatic IP checks.

Redacting an IP from model messages does not hide the network connection's source IP from a cloud provider. A VPN, proxy or separate remote worker is needed if you also want the provider to see a different connection IP. Commands and files still run on this PC in this release.

## Beam Crew

Choose **Crew** in the sidebar to work with a team of named specialist bots alongside the existing **Studio** workspace. The default team contains a Lead, Engineer, Researcher, Designer, Analyst and Writer. You can edit their names, pictures, roles, instructions and persistent memory, or add your own specialists. Pictures support ten geometric characters, colours, three faces and cropped image uploads; image metadata is removed. Job presets include research, analysis, engineering, design, writing and operations. These are original Beam assets. Image synthesis for avatars is not included. They all use the configured Beam model on Ollama Cloud; the roles give each bot a different brief and history.

Select a project, write its shared brief, then create a task for the Lead or a specialist. The Lead can delegate bounded subtasks to other bots. Each subtask has its own conversation, approvals and results. Crew returns completed team results to the Lead for a combined response. The task board shows the actual assignee and distinguishes queued work, active work, waiting for the team, questions, approvals, stopped tasks and failures. Open a task to follow its tools, reply or stop it. Stopping a parent also stops its delegated work.

Bots have their own persistent memory. Memory and the shared brief are visible and editable. Treat saved context and website/tool contents as untrusted reference material; they cannot grant new permissions. Crew inherits each task's Ask / Allow project edits / Plan mode and effort setting. Delegation keeps the same permissions and effort. On This PC, shell commands and external actions require approval. A connected Codespace can be trusted for ordinary commands in Allow project edits mode. External actions and obvious privilege/publishing commands still ask. Plan tasks cannot turn into edit tasks through delegation.

Crew tasks run one at a time because they share files, browser sign-ins and connections. Studio work in the same project must finish before queued Crew work starts; Studio cannot start in that project while Crew owns it. Switching between Studio and Crew keeps the current Studio conversation. Task history, profiles and memory survive app restarts; interrupted work is marked for review rather than silently restarted.

Crew uses a coordinator on this PC by default. Enabling Cloud Crew moves its coordinator, team profiles and new task history to the selected Codespace, where jobs can continue after Beam closes while that computer stays running. Provider idle, session and allowance limits still apply; this is not an unlimited always-on service. Scheduled routines, voice conversations and separate computers per bot are not included. Ollama Cloud usage limits apply to every specialist’s requests.

## File production and activity

The chat shows a small animated Working indicator only while the backend task is running. It includes the current phase and elapsed time. Approval waits and essential questions show Waiting for your approval/reply without working animation; completion, failure, stopping, connection loss and interrupted worker threads also stop that animation. The session sidebar follows the same state. Essential questions can include answer choices. A final response ends the task; a sentence claiming to still be working does not keep it running.

Generation now stages files, reopens them, checks actual contents and writes a checksum/quality report before publishing. Stop before publication discards the staged files. DOCX/PDF support A4 or Letter; Office files have readable content previews in Beam. XLSX checks catch broken formula references and charts without numeric data. PPTX adds process layouts and configurable colors/branding, checks canvas bounds, and avoids generic Beam branding/filler. Formula results still recalculate in Excel/LibreOffice; content previews are not native layout renders.

3D generation now preserves explicit sizes, supports mm/cm/in inputs, checks requested dimensions and component counts, and offers draft/standard/high curve quality. No small or large model is silently rescaled. GLB has crease-aware normals and optional material color/roughness/metallic values. Models include dimensioned PNG/SVG views. Assemblies include a parts CSV, separate print-oriented STL/GLB files and a ZIP. The new lidded enclosure has aligned screw bores, lid recesses and vents; the planter has a tapered cavity and drainage holes. These join the enclosure, bracket, vase and finger-jointed box presets.

Use artifact_help and inspect_artifact for format guidance and actual file contents. For custom 3D, use constraints.size_mm to record every specified outer dimension, and review the exported checks. STL has no material color; use GLB to preserve appearance. Geometry checks do not certify fits, printer supports, minimum wall thickness, load safety or visual resemblance.

## Web, browser and connections

Open **Connections** (the compass button in the top bar). Free search needs no key; Tavily is an optional API provider. The Browser panel accepts a URL or search query. Beam can read page text, follow links, fill ordinary controls and save downloads. Install Chrome or Edge; Beam uses its own persistent browser profile. Choose Show browser window to sign in manually. Local/network URLs are disabled by default and can be enabled for development previews. Beam's own control interface stays blocked.

The Cloud panel lists Drive files and previews Google Slides. Beam can read presentation structures, create decks and submit native Slides changes after approval, with revision checks to catch concurrent edits. **Follow GOOGLE_SETUP.md** (also in Connections → Google) to create your own Google OAuth Desktop client and connect your account. No shared OAuth client or Google key is bundled. Google Docs/Sheets do not have dedicated editing tools in this release; websites may be used through browser controls where supported.

MCP supports configured local stdio servers and remote Streamable HTTP endpoints with optional bearer tokens. Connect discovers tools; calls require approval. Set local arguments as a JSON array, and put credentials in the encrypted environment/bearer fields. Local servers need their own installed runtime. Generic MCP OAuth, SSE-only servers, MCP resources/prompts and image interpretation are not included.

Beam now receives runtime information up front, has one project overview tool and reuses unchanged file inspections. Successful familiar verification commands are reused within a task while project files are unchanged. Failed checks and arbitrary commands are never reused. Shell commands and managed server starts share a default budget of 8 per task (Settings: 1–40), separate from effort. The chat shows the count; reaching the limit pauses the task so you can review it. More effort gives more reasoning and tools, without automatically increasing shell commands.

Browser page text and cloud/MCP tool results used by the agent are sent to Ollama Cloud. Saved integration keys and Google refresh tokens use Windows DPAPI. Browser cookies remain in the dedicated profile; screenshots are shown to you and are not sent as image input to the text-only Beam model. Retrieved pages and tool descriptions are treated as untrusted data. Agent website actions and external writes ask for approval even in Allow project edits mode.

## What works

- Local project and session sidebar; persistent conversation history in SQLite.
- A Claude Code-style dark/light workspace with a chat, resizable file panel, text editor, diff review and streamed command output.
- A real multi-step agent: list/read/search files, write files, exact-text edits, Git status/diff, commands, and typed file generation.
- Ask before changes, Allow project edits, and read-only Plan modes.
- Diffs before approved edits; stale-file checks protect edits made while approval is pending.
- Every agent shell command requires approval. Windows subprocess job objects let Stop terminate the task’s own process tree. Managed start/status/stop server tools capture logs without blocking the testing loop. Shell instructions match the actual Windows runtime; blanket process-name kills and Unix-only commands are rejected. Python syntax and JSON are checked before code edits are saved. Repeated failures pause with an explanation instead of looping indefinitely.
- DOCX/PDF: complete Markdown documents, styled headings/tables, page numbers, Unicode fonts and repeating table headings.
- XLSX: typed numeric/date/percentage values, preserved formulas, column formats, conditional color scales and real native Excel bar/line/pie charts. Chart count and formula count are returned to the agent. Excel/LibreOffice recalculates formulas when opening the file; the app does not evaluate formula results.
- PPTX: title, section, metrics, comparison, native chart, paginated table and bullet layouts; notes and overflow checks.
- Charts, SVG/text/code, ZIP bundles, and the existing validated STL/GLB pipeline. 3D exports include editable model JSON, a validation report and a four-view image preview.
- PDF/raster previews, an offline interactive STL/GLB viewer (orbit, zoom, isometric/front/right/top views), native folder picking and Save a copy dialogs. The model’s editable source can be attached to a follow-up.
- CAD reference tools plus dimensioned presets for a finger-jointed five-panel box, screw-post enclosure, gusseted mounting bracket and hollow lathed vase. The box also exports separate, flat panel STL/GLB files and a parts ZIP. It is an intentional assembly with an inset floor that needs securing; it is not a certified manufacturing design. Export details include dimensions, volume, topology and component count.
- An effort slider: Low (20 steps, 6,000 output tokens per model turn, thinking disabled where supported), Medium (48 / 12,000), High (96 / 22,000), Max (160 / 32,000). Higher settings request more thorough planning and checks and have larger time budgets. Ollama/model limits still apply; effort does not guarantee correctness.
- Local API token, loopback binding, origin/host checks and credential-path exclusions. Saved Ollama keys use Windows account-bound DPAPI encryption and are never returned to the page.

## Scope of this build

This is an installable desktop release, with its own Beam branding and a Claude Code-style interface. It does not provide full feature parity with Claude Code or Codex. Isolated Git worktrees, a full interactive PTY, general desktop computer control, remote jobs and automatic updates are not implemented. Browser automation works through page text and semantic controls; canvas-only applications may require manual interaction. Command output is a non-interactive streamed panel. Git diffs include existing tracked working-tree changes; edits made by Beam also appear in the session timeline. Binary Office editing is through generation rather than a full Office editor.

Commands execute with the Windows account's permissions. Project path checks apply to file tools; they are not an operating-system sandbox for approved shell commands. Prompts, code read by the agent and tool results are sent to Ollama Cloud. Common credential files, Git internals and dependency folders are excluded from ordinary agent file reads. Approval dialogs show the actual command or diff.

Beam is text-only. Raster image synthesis still requires the existing optional Cloudflare credentials (`CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`); it is not supplied by Beam. SVG illustrations and charts do not need a separate image model. Arbitrary website previews do not execute inside the app origin.

## Run from source

Use Python 3.11–3.14 on Windows:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-desktop.txt
.\.venv\Scripts\python.exe desktop.py
```

Without `portable.flag`, sessions/settings use `%LOCALAPPDATA%/Beam`. Set `BEAM_DATA_DIR` or pass `--data-dir` to change this. `OLLAMA_API_KEY` is accepted as an environment fallback. The desktop uses Beam exclusively; it does not automatically switch to a different model/provider.

```powershell
# Local browser development
.\.venv\Scripts\python.exe desktop.py --headless --port 8769 --data-dir .dev-data

# Meaningful unit/integration tests (network-free)
.\.venv\Scripts\python.exe -m unittest discover -s tests -v

# Generate and reopen ten document/CAD outputs
.\.venv\Scripts\python.exe desktop.py --self-test
```

## Build the Windows installer

```powershell
.\.venv\Scripts\python.exe -m pip install pyinstaller
.\.venv\Scripts\python.exe -m PyInstaller --noconfirm Beam.spec
# Compile Beam-Setup.nsi with NSIS 3.x, passing APPDIR, OUTFILE and WEBVIEWSETUP defines.
# WEBVIEWSETUP points to Microsoft's signed WebView2 bootstrapper.
```

The installer packages the entire `dist/Beam` folder; omit `portable.flag`, any `BeamData` and test files. Do not distribute API keys or test data. The build is unsigned.

The original web entry point `app.py`, its tests and 3D examples remain available. See `LEGACY_README.md` and `SETUP.md` for that earlier hosting workflow. Use `desktop.py` for the desktop app.
