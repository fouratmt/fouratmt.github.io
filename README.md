# fourat.dev — Personal Website (Hugo + PaperMod)

This is the source for my personal website, built with [Hugo](https://gohugo.io/) and the [PaperMod](https://github.com/adityatelange/hugo-PaperMod) theme (as a Git submodule). The site is bilingual (English/French).

## Requirements
- Hugo Extended ≥ 0.114.0
- Git (for submodules)

Verify your Hugo version:

```
hugo version
```

## Getting Started

1) Clone and initialize submodules
```
git clone <this-repo>
cd my-website
git submodule update --init --recursive
```

2) Run the dev server
```
# Includes drafts (-D) if you want to preview them locally
hugo server -D
```
The site will be available at http://localhost:1313.

3) Build production output
```
hugo --gc --minify
```
Static files will be generated into `public/`.

## Theme Updates (PaperMod)
Update the theme submodule to the latest upstream:
```
git submodule update --remote --merge themes/PaperMod
# review changes, then
git add themes/PaperMod
git commit -m "chore(theme): update PaperMod"
```

## Structure
- `content/en|fr/`: Pages and posts per language
- `layouts/`: Template overrides and custom partials/shortcodes
- `static/`: Static files served as-is (images, PDFs, icons)
- `themes/PaperMod/`: Theme submodule
- `config.yml`: Site configuration

## Deployment
Deployed via GitHub Actions to GitHub Pages on pushes to `main`.
The workflow builds with Hugo Extended and uploads the `public/` artifact.

## Common Tasks (Makefile)
A `Makefile` is included for convenience. See `make help` for targets.
