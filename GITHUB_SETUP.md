# Use GitHub Codespaces with Beam

You do not need to type commands on your PC. Keep the GitHub sign-in page private; never paste its tokens into a chat.

## 1. Create the computer in your browser

1. Sign into a personal free GitHub account.
2. Create a private repository, for example `beam-workspace`, with a README.
3. Open **Code → Codespaces → Create codespace on main**. Choose the smallest **2-core** machine. There is no 1-core Codespaces machine.
4. Wait until its editor opens. You may close that editor once Beam is connected.

Use the default Linux environment. Custom containers need an SSH server, Python 3 and passwordless sudo for their service user. Beam needs those to install its worker and create a separate command account. Do not place unrelated private projects or credentials in this computer.

## 2. Connect inside Beam

1. Open a project, or let Beam create a workspace.
2. Click **Project computer** in the top bar.
3. Click **Connect GitHub**, finish browser sign-in and approve Codespaces access. If GitHub asks for a device code, use the short code shown in Beam.
4. Click **Refresh**, select your computer and choose **Install worker**. This installs the worker, artifact libraries and restricted task account remotely. It can take a few minutes and uses running hours. It does not install them on your PC.
5. Set the command and five-minute auto-stop options, then choose **Use Codespace**.

The label in the top bar will show Codespaces. File operations and commands now use `/workspaces/.beam-projects/<project-id>` on that computer. The original local folder stays separate. Review local files before explicitly uploading them, and use Save a copy for cloud outputs.

## 3. Let Crew continue with Beam closed

1. Reopen **Project computer**.
2. Read the Cloud Crew credential/storage explanation and tick its consent box.
3. Choose **Enable Cloud Crew**.
4. Switch to **Crew**, give a teammate a job, and start a task.

New team tasks and their coordinator run on the Codespace. The initial local profiles and brief seed this team; later edits are stored there. Each teammate has a separate conversation. Closing Beam leaves cloud jobs running as long as GitHub keeps the machine running. Studio and PC jobs still require Beam open. Cloud Crew cannot use browser sign-ins, Google or MCP connections stored on your desktop.

Ask mode requires approvals, so jobs will pause for those. Trusted Codespace + Allow project edits lets routine commands proceed. Plan cannot edit. Private-model requests and essential questions also pause until you return; they do not silently send sensitive details to Ollama.

In GitHub's [Codespaces settings](https://github.com/settings/codespaces), review the default idle timeout if you want longer sessions. Beam does not manufacture activity to avoid GitHub limits. The public update API does not support changing an existing Codespace's idle timeout. The optional Beam auto-stop applies after five minutes without active task work; it can stop machines waiting for a reply, too. Resume the computer and review interrupted work to continue.

## 4. Switch back to this PC

Finish or stop cloud tasks. Disconnect Cloud Crew in Project computer, then choose **Use this PC**. Your original local folder and desktop integrations return. Both computer choices still use Ollama Cloud for coding. Files do not synchronize automatically.

Disconnect removes this project's enabled cloud link. When the last project disconnects, the worker deletes its stored Ollama/GitHub credential copies. Cloud task history and output files remain until you remove the Codespace. Uninstalling Beam preserves app/project data and does not stop or delete a cloud computer. Stop or disconnect it first if you do not want background work.

## Free allowance and limits

A personal GitHub Free account currently includes 120 core-hours per month (about 60 hours on a 2-core machine) plus 15 GB-month storage. Check the account's Billing page for current usage and eligibility. Keep payment details unset if you only want the included allowance. Stopped Codespaces continue using storage; delete ones you no longer need after exporting your results.

GitHub can stop a Codespace at its idle timeout and enforces a 12-hour maximum continuous session, including during active use. Running out of allowance also stops availability. Restart preserves `/workspaces` files, while unfinished jobs become interrupted and need review. Deleting the Codespace deletes its local files/history. This is a limited free worker, not a guaranteed 24/7 server.

Official references: [quickstart](https://docs.github.com/en/codespaces/getting-started/quickstart), [billing](https://docs.github.com/en/billing/concepts/product-billing/github-codespaces), [lifecycle and limits](https://docs.github.com/en/codespaces/about-codespaces/understanding-the-codespace-lifecycle).

## Troubleshooting

- No computers: sign into the owning account, create a Codespace in the browser and refresh.
- Setup fails: check that the default Codespace environment is running and your allowance is available. Reconnect GitHub, then retry Install worker. A custom container might lack SSH, Python or sudo; use the standard environment.
- Disconnected: choose Resume in Project computer. Automatic polling does not repeatedly wake stopped computers and spend the allowance.
- Git ownership check: commands run as a separate task user. Use the built-in Git tools; for explicit Git commands, apply `git -c safe.directory=<project-root>` only to the managed project folder.
- Private text before transfer: cancel the transfer prompt and use This PC to process it with desktop privacy controls. Files already stored in Codespaces are already on GitHub infrastructure.

Live account authentication and Linux account provisioning require your GitHub sign-in. Release tests cover transport fixtures and coordinator behavior; they do not establish that your specific Codespace has connected successfully.
