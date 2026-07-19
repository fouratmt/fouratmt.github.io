# fourat.dev

Bilingual English/French portfolio for Fourat Mastouri, built with Hugo Extended and PaperMod. GitHub Actions validates and deploys the public website to GitHub Pages. Docker is used only for local development and production-like previews.

## Requirements

- Git, including submodule support
- Hugo Extended 0.164.0 for native development
- Python 3 for generated-site validation
- Docker and Docker Compose when using the container workflow

## Initialize

```bash
git submodule update --init --recursive
```

## Native development

```bash
make serve
```

The development server is available at <http://localhost:1313/> and includes drafts.

Build and validate without writing to the committed source tree:

```bash
make check
make quality
```

The native targets verify that the installed Hugo version matches `.hugo-version` before building. `make quality` performs a warning-as-error Hugo build and validates generated routes, local assets, language links, metadata, and core accessibility semantics. CI also runs `make browser-smoke` in headless Chrome to catch runtime errors, failed assets, mobile overflow, and incorrect translated routes.

## Encrypted pages

GitHub Pages cannot perform server-side authentication, so protected pages use authenticated client-side encryption. Their Markdown and Hugo-rendered HTML are encrypted locally with AES-256-GCM. The repository and deployed page contain only a metadata shell plus ciphertext; the password is never part of the Hugo build, repository, or GitHub Actions environment.

Create the ignored local password file once:

```bash
make protected-password
```

The generated `.protected-pages-password` file is mode `0600` and ignored by Git. Back it up in your password manager. You can instead provide `PROTECTED_PAGE_PASSWORD` or `PROTECTED_PAGE_PASSWORD_FILE`; values must contain at least 16 characters.

Create a normal bilingual pair of Markdown pages and add the protection flag:

```toml
+++
title = "Private page"
passwordProtected = true
+++

Write normal Markdown here.
```

Then encrypt each page before committing it:

```bash
make protect-page PAGE=content/en/private-page.md
make protect-page PAGE=content/fr/private-page.md
```

The command renders the body with Hugo, encrypts both the rendered HTML and editable Markdown, creates an opaque JSON payload below `static/protected-pages/`, adds `encryptedPayload` to the front matter, and removes the plaintext body. The JSON is only an encryption envelope containing the algorithm identifiers, PBKDF2 iteration count, random salt, random IV, and ciphertext.

Edit an existing page without restoring plaintext inside the repository:

```bash
EDITOR=nano make edit-protected-page PAGE=content/en/private-page.md
```

The decrypted Markdown exists only in a mode-restricted temporary directory while the editor is open. Saving and closing the editor renders and encrypts it again, then removes the temporary directory. `VISUAL` takes precedence over `EDITOR`. If the editor or Hugo fails, the command prints the preserved draft path so the edit can be recovered instead of silently deleting it:

```bash
make recover-protected-page PAGE=content/en/private-page.md DRAFT=/printed/recovery/path/private-page.md
```

The recovery command leaves the plaintext draft in place. Remove it after checking the encrypted page.

Protected pages use the normal PaperMod header, footer, typography, responsive layout, language switch, and theme toggle. Before decryption they show a matching password form; afterward the decrypted HTML is inserted into the normal `.post-content` container. They are marked `noindex, nofollow`, excluded from sitemaps, and must not be added to menus or public content.

Validate that every protected source is an empty stub backed by a structurally valid encrypted payload:

```bash
make verify-protected-pages
```

This check is also part of `make quality` and CI. The browser smoke test replaces one built payload with an ephemeral fixture in `/tmp` so it can verify wrong-password rejection and successful decryption without knowing the real password.

This design prevents repository readers, page-source readers, ordinary crawlers, and bots without the password from reading the protected body. Because the ciphertext is public, an attacker can still attempt password guesses offline; use a long, unique, randomly generated password. Once unlocked, browser extensions, malware, screenshots, or automation with access to that browser session can read the rendered content.

## Local Docker development

Build and run the local NGINX preview:

```bash
make docker-up
```

Open <http://localhost:8080/>. The multi-stage image uses the official Hugo container to build the site and an unprivileged NGINX runtime to serve a production-like local preview with security headers. The runtime filesystem is read-only under Docker Compose.

This container is never deployed to `fourat.dev`; the public website is served by GitHub Pages.

Stop it with:

```bash
make docker-down
```

For live-reload development entirely inside Docker:

```bash
make docker-dev
```

Open <http://localhost:1313/>. The repository is mounted into the Hugo container, so the PaperMod submodule must already be initialized.

Equivalent direct commands are:

```bash
docker build -t fourat-dev:local .
docker run --rm -p 8080:8080 --read-only --tmpfs /tmp --tmpfs /var/cache/nginx fourat-dev:local
```

## Résumé PDFs

The downloadable files in `static/resume_en.pdf` and `static/resume_fr.pdf` are build artifacts from a separate LaTeX repository. That repository's GitHub Actions workflow builds and commits updated PDFs here.

Do not edit or regenerate the PDF files in this project. The current `/cv/` and `/fr/cv/` pages provide accessible open/download wrappers for these PDFs. Full bilingual HTML résumé content is intentionally deferred to a separate pull request.

## Content conventions

- Add or change public content in both `content/en/` and `content/fr/`.
- Put processable source images in `assets/`; keep passthrough files such as favicons and PDFs in `static/`.
- Customize PaperMod through `layouts/` and `assets/css/extended/`; never edit the theme submodule directly.
- Do not commit `public/` or generated Hugo resources.

## Deployment

Pull requests run the quality workflow, including validation of the optional local Docker preview image. Pushes to `main` run the same site checks before the GitHub Pages artifact is uploaded and deployed. The workflow pins Hugo 0.164.0, matching `.hugo-version` and the Docker builder.

Production response-header configuration for the Cloudflare/GitHub Pages deployment is documented in [`docs/security-headers.md`](docs/security-headers.md).
