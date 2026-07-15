# fourat.dev

Bilingual English/French portfolio for Fourat Mastouri, built with Hugo Extended and PaperMod. GitHub Actions validates and deploys the site to GitHub Pages; Cloudflare serves the custom domain.

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

`make quality` performs a warning-as-error Hugo build and validates generated routes, local assets, language links, metadata, and core accessibility semantics. CI also runs `make browser-smoke` in headless Chrome to catch runtime errors, failed assets, mobile overflow, and incorrect translated routes.

## Docker

Build and run the production image:

```bash
make docker-up
```

Open <http://localhost:8080/>. The multi-stage image uses the official Hugo container to build the site and an unprivileged NGINX runtime to serve it with security headers. The runtime filesystem is read-only under Docker Compose.

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

## Résumé source and PDFs

The accessible HTML pages in `content/en/cv.md` and `content/fr/cv.md` are the source of truth. Regenerate the tagged downloadable PDFs after editing them:

```bash
python3 -m pip install -r requirements-pdf.txt
make resume-pdfs
```

The command writes review copies to `output/pdf/` and updates the website copies in `static/`. Render and visually review both PDFs before committing changes.

## Content conventions

- Add or change public content in both `content/en/` and `content/fr/`.
- Put processable source images in `assets/`; keep passthrough files such as favicons and PDFs in `static/`.
- Customize PaperMod through `layouts/` and `assets/css/extended/`; never edit the theme submodule directly.
- Do not commit `public/` or generated Hugo resources.

## Deployment

Pull requests run the quality workflow. Pushes to `main` run the same checks before the GitHub Pages artifact is uploaded and deployed. The workflow pins Hugo 0.164.0, matching `.hugo-version` and the Docker builder.

Production response-header configuration for the Cloudflare/GitHub Pages deployment is documented in [`docs/security-headers.md`](docs/security-headers.md).
