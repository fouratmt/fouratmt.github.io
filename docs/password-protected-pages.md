# Password-protected pages

This guide documents the complete lifecycle of encrypted Hugo pages on `fourat.dev`.

## Overview

GitHub Pages serves static files and cannot validate passwords on a server. Protected pages therefore use authenticated client-side encryption:

1. Markdown is authored locally.
2. The local protection command renders it with Hugo.
3. The source Markdown and rendered HTML are encrypted with AES-256-GCM.
4. The Markdown file becomes a metadata-only Hugo page stub.
5. Only the stub and encrypted JSON payload are committed.
6. The browser downloads the ciphertext and decrypts it locally after the visitor enters the password.

The title, description, language, URL, encryption parameters, and encrypted payload URL are public. The Markdown body, rendered body, and password are not present in the repository or initial HTML.

## Security model

The local tool uses:

- PBKDF2-SHA256 with 600,000 iterations to derive a key from the password.
- A new random 16-byte salt for every encryption.
- AES-256-GCM with a new random 12-byte IV for every encryption.
- A 128-bit GCM authentication tag appended to the ciphertext.

The JSON payload contains `version`, `kdf`, `cipher`, `iterations`, `salt`, `iv`, and `ciphertext`. The algorithm names, work factor, salt, and IV are intentionally public and are required for decryption. Only the password-derived encryption key must remain secret.

All pages use `.protected-pages-password` by default. They therefore share one password, while their random salts and IVs produce different derived keys and ciphertext. A page can use a different password by supplying a different password environment variable or password file whenever that page is encrypted or edited.

Because the ciphertext is public, an attacker can attempt password guesses offline. Use a long, unique, randomly generated password. Client-side encryption cannot protect content after it has been decrypted in a compromised browser, browser extension, screenshot, or automation session.

## Prerequisites

- Hugo Extended at the version specified in `.hugo-version`.
- Node.js.
- An initialized PaperMod submodule.
- A local password containing at least 16 characters.

Initialize the project if necessary:

```bash
make init
```

## Configure the local password

### Recommended: generated local password file

Run once:

```bash
make protected-password
```

This creates `.protected-pages-password` with mode `0600`. The file is ignored by Git. The command does not replace an existing password file.

Store a backup in a password manager. If this password is lost, the encrypted Markdown and HTML cannot be recovered.

### Alternative: another password file

Set the file for an individual command:

```bash
PROTECTED_PAGE_PASSWORD_FILE=/secure/path/password.txt \
  make protect-page PAGE=content/en/private-page.md
```

Use the same setting when editing that page later.

### Alternative: environment variable

Avoid putting the password directly in a command because shell history may retain it. Read it without echoing:

```bash
read -s PROTECTED_PAGE_PASSWORD
export PROTECTED_PAGE_PASSWORD
make protect-page PAGE=content/en/private-page.md
unset PROTECTED_PAGE_PASSWORD
```

Password lookup order is:

1. `PROTECTED_PAGE_PASSWORD`.
2. The file named by `PROTECTED_PAGE_PASSWORD_FILE`.
3. `.protected-pages-password` in the repository root.

The password is not sent to GitHub Actions and is not needed during deployment.

## Create a protected bilingual page

The protected archetype can create the initial English page:

```bash
hugo new --kind protected content/en/private-page.md
```

Create the corresponding French page as well. Protected pages follow the same bilingual-content rule as public pages.

Before encryption, a page should look like this:

```toml
+++
title = "Private page"
description = "Private page description."
translationKey = "private-page"
draft = false
passwordProtected = true
+++

Write the private Markdown here.
```

Use the same `translationKey` in both language files. It is a public Hugo translation identifier, not an encryption key. TOML frontmatter is preferred, although the tool also supports YAML frontmatter.

The only encryption field authored manually is:

```toml
passwordProtected = true
```

The protection command adds the remaining internal fields.

## Encrypt a new page

Encrypt both language versions before staging or committing them:

```bash
make protect-page PAGE=content/en/private-page.md
make protect-page PAGE=content/fr/private-page.md
```

For each page, the command:

1. Reads the configured local password.
2. Renders the Markdown with Hugo, including project and PaperMod shortcodes.
3. Encrypts an object containing both editable Markdown and rendered HTML.
4. Writes an opaque payload such as `static/protected-pages/0123456789abcdef01234567.json`.
5. Adds `encryptedPayload` and `robotsNoIndex` to the page frontmatter.
6. Removes the plaintext Markdown body from the content file.

The resulting committed stub resembles:

```toml
+++
title = "Private page"
description = "Private page description."
translationKey = "private-page"
draft = false
passwordProtected = true
encryptedPayload = "/protected-pages/0123456789abcdef01234567.json"
robotsNoIndex = true
+++
```

`encryptedPayload` is the stable identity of the ciphertext. Do not edit it manually.

Before committing, confirm that the Markdown body is empty and stage both the stub and its JSON payload. Never stage `.protected-pages-password` or a recovery draft.

## Decrypt and view in a browser

Open the exact page URL, for example:

```text
https://fourat.dev/private-page/
https://fourat.dev/fr/private-page/
```

The initial HTML contains the normal PaperMod header, footer, language switch, theme controls, public page metadata, and password prompt. It does not contain the protected body.

After password submission, the browser:

1. Fetches the page's JSON payload.
2. Derives an AES key from the entered password and payload salt.
3. Authenticates and decrypts the ciphertext with AES-GCM.
4. Parses the decrypted rendered HTML.
5. Inserts it into the normal PaperMod `.post-content` container.
6. Clears the password field.

The implementation does not put the password or plaintext in cookies, `localStorage`, or `sessionStorage`. Refreshing or navigating away locks the page again. A browser password manager may offer to store the password locally because the input uses `autocomplete="current-password"`.

## Decrypt and edit locally

Use the editing command instead of adding plaintext back to the committed stub:

```bash
EDITOR="code -w" make edit-protected-page PAGE=content/en/private-page.md
```

Or with another editor:

```bash
EDITOR=nano make edit-protected-page PAGE=content/en/private-page.md
```

`VISUAL` takes precedence over `EDITOR` when both are set.

The edit command:

1. Reads and authenticates the existing payload with the local password.
2. Writes only the decrypted Markdown to a mode-`0600` temporary file.
3. Opens that file in the configured editor.
4. Waits for the editor to close.
5. Renders the edited Markdown with Hugo.
6. Re-encrypts the Markdown and HTML with a new random salt and IV.
7. Replaces the existing JSON payload atomically.
8. Deletes the temporary plaintext directory after success.

There is intentionally no normal command that writes a persistent plaintext copy into `content/`. Local decryption for authoring happens through the temporary editor file.

## Recover a failed edit

If the editor exits unsuccessfully or Hugo cannot render the edited Markdown, the original encrypted payload remains intact. The command preserves the temporary plaintext draft and prints its path:

```text
Plaintext draft preserved for recovery: /tmp/fourat-protected-edit-.../private-page.md
```

After correcting the problem in that draft, encrypt it back into the page:

```bash
make recover-protected-page \
  PAGE=content/en/private-page.md \
  DRAFT=/tmp/fourat-protected-edit-.../private-page.md
```

The recovery command does not delete the supplied plaintext file. Preview and verify the encrypted page, then delete the recovery file and its empty temporary directory.

Common render failures include malformed Hugo shortcodes, missing shortcode arguments, or references to unavailable assets. The error output includes Hugo's diagnostics.

## Rename or move a protected page

Rename the Markdown stubs normally, in both languages:

```bash
git mv content/en/private-page.md content/en/links.md
git mv content/fr/private-page.md content/fr/links.md
```

Keep each existing `encryptedPayload` value unchanged. The payload URL is deliberately independent of the current Markdown filename, so renaming does not require decryption, re-encryption, or moving the JSON file.

Update `translationKey` only if the logical translation identity should also change. Run verification after the rename:

```bash
make verify-protected-pages
make quality
```

The public page URL changes with the Hugo content path. Update any private bookmarks manually; protected routes must not be added to public menus or public content.

## Delete a protected page

When permanently deleting a protected page:

1. Record the `encryptedPayload` path from its frontmatter.
2. Delete both language stubs.
3. Delete both referenced JSON payloads.
4. Run `make verify-protected-pages`.

Leaving a JSON file without a referencing page produces an `orphaned encrypted payload` error. Deleting a stub without first recording its payload path makes identifying the corresponding orphan less convenient.

## Change a page's password

There is currently no single-step rekey command. Password rotation uses the recovery workflow:

1. With the old password configured, run `edit-protected-page`.
2. Save a secure plaintext copy from the editor outside the repository.
3. Allow the normal edit to finish, preserving the old encrypted version as a fallback.
4. Configure the new password.
5. Run `recover-protected-page` with the secure plaintext copy.
6. Confirm browser decryption with the new password.
7. Delete the plaintext copy.

For a shared-password rotation, retain the old password until every protected page has been re-encrypted and verified. Losing the old password before exporting or re-encrypting every payload makes the remaining pages unrecoverable.

## Validate before committing

Validate encrypted source stubs and payload envelopes:

```bash
make verify-protected-pages
```

This detects:

- A protected page whose plaintext body was not removed.
- A missing or malformed `encryptedPayload` reference.
- A missing or malformed JSON envelope.
- A JSON payload not referenced by any protected page.
- An `encryptedPayload` field on a page without `passwordProtected = true`.

Run the complete site validation:

```bash
make quality
make browser-smoke
```

`make quality` verifies the encrypted payload structure, Hugo build, generated routes, metadata, accessibility, and sitemap exclusion. The browser smoke test substitutes a temporary encrypted fixture in the generated `/tmp` site to test wrong-password rejection and successful browser decryption without access to the real password.

CI and GitHub Pages never receive the real password.

## What to commit

Commit:

- The metadata-only Markdown stubs under `content/en/` and `content/fr/`.
- Their JSON payloads under `static/protected-pages/`.
- Any intentional public metadata changes.

Never commit:

- `.protected-pages-password`.
- A plaintext protected-page body.
- A preserved recovery draft.
- A password copied into configuration, frontmatter, scripts, tests, or CI secrets.

Before committing, inspect `git status` and confirm the password file remains ignored:

```bash
git status --short
git check-ignore .protected-pages-password
```

## Search-engine and discovery behavior

Protected pages:

- Receive `noindex, nofollow, noarchive, nosnippet, noimageindex` metadata.
- Are excluded from generated sitemaps.
- Are not linked from public pages by validation rules.
- Use opaque payload filenames.

These controls reduce accidental discovery but do not provide access control. The page path, title, description, JavaScript, and ciphertext can still be discovered through the public repository, server logs, shared bookmarks, or direct requests. Confidentiality depends on encryption and password strength, not URL secrecy or crawler compliance.

## Troubleshooting

### `missing encryptedPayload`

The page has `passwordProtected = true` but has not been encrypted successfully. Add the plaintext body locally and run `make protect-page`.

### `page has no plaintext body and no existing encrypted payload`

The stub has no body and its referenced payload is missing. Restore the JSON payload from version control or restore the Markdown from a secure backup before encrypting again.

### `orphaned encrypted payload`

No protected Markdown stub references that JSON file. Restore the missing stub or delete the payload if the page was intentionally removed.

### Incorrect password in the browser

Confirm that the password used in the browser matches the password used during the most recent encryption. If a page uses a custom password file, the shared `.protected-pages-password` value will not unlock it.

### Local authentication or decryption failure

The configured local password does not match the payload, or the payload is damaged. Retry with the correct password source. Do not overwrite the payload until the correct password or a plaintext backup is available.

### Hugo shortcode or rendering failure

Read the Hugo diagnostics printed after the error. The plaintext draft is preserved and its path is printed. Fix the draft and use `recover-protected-page`.

### Rename verification failure

Current tooling treats `encryptedPayload` as stable across renames. Keep its existing value. If an older checkout expects a new path-derived payload, update to the current `scripts/protected_page.mjs` before verifying.

## Implementation files

- `scripts/protected_page.mjs`: local encryption, editing, recovery, and verification.
- `assets/js/password-protection.js`: browser-side key derivation and decryption.
- `layouts/partials/password_gate.html`: themed password prompt.
- `layouts/_default/baseof.html`: protected-page shell integration.
- `layouts/partials/extend_head.html`: protected-page robots metadata and JavaScript loading.
- `layouts/_default/sitemap.xml`: protected-page sitemap exclusion.
- `assets/css/extended/custom.css`: themed locked-page interface.
- `scripts/check_site.py`: generated-site secrecy and route validation.
- `scripts/browser_smoke.mjs`: browser behavior validation with an ephemeral fixture.
