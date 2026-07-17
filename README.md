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
