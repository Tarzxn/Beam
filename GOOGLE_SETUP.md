# Connect Google Drive and Slides to Beam

Open Beam → Connections (compass button) → Google. This release uses your own Google Cloud OAuth Desktop client. You enter no Google password into Beam.

1. Sign in to [Google Cloud Console](https://console.cloud.google.com/) and create or select a project.
2. In APIs & Services → Library, enable **Google Drive API** and **Google Slides API** for that project.
3. Open Google Auth Platform → Branding. Set an app name such as Beam Personal, your support email and contact email. Complete the consent configuration.
4. Under Audience, choose External for a personal Google account. Keep the app in Testing and add the exact Google account you will connect as a test user. A managed Workspace account may instead use Internal if your organisation allows it.
5. Under Data Access, configure the permissions requested by Beam: `openid`, `email`, `https://www.googleapis.com/auth/drive.readonly` and `https://www.googleapis.com/auth/presentations`. These allow identifying the account, listing/reading Drive metadata and reading/editing Slides. This release does not request Drive write access.
6. Under Clients, create an OAuth client with application type **Desktop app**. Download its JSON. Do not use an API key, service account or Web application client. If the console offers an AI agent client option, review Google's linked instructions for that choice.
7. In Beam → Connections → Google, choose **Import Desktop client JSON**, select the downloaded file, then **Connect Google**.
8. In your normal browser, sign in and approve the requested permissions. A local callback page confirms completion. Return to Beam; it should show your connected account.

Beam uses PKCE and a temporary loopback callback on `127.0.0.1`; no public callback hosting or manually configured web redirect is needed for this Desktop client. Keep Beam open while connecting. The sign-in attempt expires after three minutes; retry if needed.

Use the Cloud tab to search Drive files and view a presentation. For example, ask Beam: “Read this Google Slides deck and make slide 2 clearer: [paste your deck URL].” It reads the current revision and asks for approval before an API update. Re-read if another editor changed the deck. Only files accessible to the connected account can be used.

Disconnect in Connections → Google to remove Beam's saved token and attempt revocation. Google Testing mode may require periodic reconnection. If permissions change, disconnect and connect again.

Troubleshooting:

- “Access blocked” or `access_denied`: check the test user, audience and your Workspace administrator's policies.
- “API not enabled” / HTTP 403: verify both APIs are enabled in the same project that owns the client, and that the account can access the deck.
- Client/redirect errors: download a **Desktop app** client JSON and import it again.
- Local callback cannot connect: keep Beam running and check whether local firewall rules block loopback access.
- Saved credentials cannot be read: reconnect under the same Windows account. DPAPI credentials are account-bound.

OAuth import, state validation, PKCE exchange, refresh and Slides revision checks are covered by automated mocked tests. Live Google account access has not been verified because no Google client/account was supplied.

Sources: [Google's Desktop OAuth guide](https://developers.google.com/identity/protocols/oauth2/native-app), [Slides setup quickstart](https://developers.google.com/workspace/slides/api/quickstart/python).
