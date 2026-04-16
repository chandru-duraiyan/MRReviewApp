# MR Review App

A lightweight, single-page browser app for tracking GitLab Merge Request review assignments. It fetches the latest review-assignment comment from a MR, parses reviewer details, computes the minimum set of reviewers needed to cover all pending files, and gives you one-click tools to ask those reviewers.

---

## Features

- **Auto-fetch review assignment** — fetches the latest MR comment containing reviewer details. If none is found, automatically posts `@gunther pendingreview` and waits for the bot to generate the assignment.
- **Minimum reviewer computation** — greedy set-cover algorithm finds the smallest group of reviewers (across primary and backup) that covers every pending file.
- **Already Reviewed** — reviewers who gave a 👍 reaction directly on the MR are displayed and automatically excluded from the minimum reviewer calculation.
- **Exclude reviewers** — click ✕ on any reviewer chip to remove them from consideration and recompute instantly. A reviewer cannot be removed if doing so would leave any file with no eligible reviewer.
- **Ask for Review panel** — pre-fills a customisable review request message with an MR link. Supports multiple message templates (Default, Urgent, Before EOD) and salutation options.
- **Copy JSON** — copies a structured JSON payload of pending reviewers, the request message, MR title, and MR link — ready to paste into Zoho Cliq's `/zfpackagereview` command to auto-send messages to all reviewers.
- **Credential persistence** — `accessToken` and `gitUsername` are saved to `localStorage`. `config.js` values take priority; user edits in Settings are persisted automatically across page reloads.
- **MR dropdown** — focus the MR ID field to see a dropdown of your open MRs fetched from GitLab.
- **Dark / Light theme** with accent colour presets.

---

## Getting Started

No build step required. Just open `index.html` directly in a browser.

```bash
open index.html
```

Or serve it locally:

```bash
npx serve .
# or
python3 -m http.server
```

---

## Configuration

Edit `config.js` to set your defaults. Values here take priority over anything stored in `localStorage`.

```js
const CONFIG = {
  gitlabUrl:   'https://gitlab.com',          // GitLab instance URL
  projectPath: 'namespace/project',           // e.g. zohofinance/zohobooks_server
  accessToken: '',                             // Personal Access Token (read_api scope)
  gitUsername: '',                             // Your GitLab username
};
```

If `accessToken` or `gitUsername` are left empty in `config.js`, the app restores them from `localStorage` (saved from your last session or Settings edits).

### Personal Access Token

1. Go to GitLab → **Edit profile** → **Access tokens**
2. Click **Add new token**
3. Select the `read_api` scope and set an expiry
4. Paste the generated token into Settings or `config.js`

---

## Customising Message Templates

Edit `ask-messages.js` to add or modify the message templates and salutation options shown in the Ask for Review panel.

```js
const ASK_MESSAGES = [
  {
    id:    'default',
    label: 'Default',
    text:  'Hi{salutation}, could you please review this MR when you have a moment? {link}',
  },
  // add more templates here
];

const ASK_SALUTATIONS = [
  { id: 'none', label: 'None', value: ''      },
  { id: 'bro',  label: 'Bro',  value: ' Bro' },
  // add more salutations here
];
```

- `{salutation}` is replaced with the selected salutation value at runtime.
- `{link}` is replaced with a clickable MR link.

---

## Copy JSON — Zoho Cliq Integration

The **Copy JSON** button in the Ask for Review panel copies a payload in this format:

```json
{
  "data": [
    {
      "not_reviewed_by": ["chandru.d", "ram.m"],
      "message": "Hi, could you please review this MR when you have a moment?",
      "mr_title": "MR !147082 — [BUGFIX] Final Refund Adjustment Changes",
      "mr_link": "https://gitlab.example.com/namespace/project/-/merge_requests/147082"
    }
  ]
}
```

**To send review requests via Zoho Cliq:**

1. Click **Copy JSON** in the Ask for Review panel
2. Open [Zoho Cliq](https://cliq.zoho.in)
3. Enter `/zfpackagereview` in any chat
4. Paste the copied JSON as input
5. The template message is automatically sent to all reviewers in the minimum reviewers list

> The `not_reviewed_by` list only includes reviewers from the **Enough Reviewers** section. Reviewers you excluded via ✕ are not included.

---

## Project Structure

```
MRReviewApp/
├── index.html        # Main UI — layout, settings drawer, results sections
├── app.js            # All app logic — GitLab API, reviewer computation, rendering
├── ask-messages.js   # Message templates and salutation options
├── config.js         # Default configuration values
└── style.css         # All styles — theming, components, layout
```

---

## How It Works

1. You enter a Merge Request ID and click **Fetch**
2. The app fetches the latest MR notes and looks for a structured review-assignment comment
3. If none is found, it posts `@gunther pendingreview` and waits 12 seconds for the bot to generate one
4. The comment is parsed into file sections (**Needs Approval**, **Backup Approved**, **Approved**)
5. A greedy set-cover algorithm computes the minimum reviewers needed across all pending files
6. Reviewers who already gave a 👍 on the MR are shown as **Already Reviewed** and excluded from the calculation
7. Use the **Ask for Review** panel to copy a message or JSON payload to contact the remaining reviewers
