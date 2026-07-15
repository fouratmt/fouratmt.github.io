# Project Overview

fourat.dev is a bilingual personal portfolio website for Fourat Mastouri, a Senior Data Engineer Consultant. Built with Hugo Extended and the PaperMod theme, it showcases professional experience, skills, and contact information in English and French. The site features profile mode landing, responsive design, SEO optimization, Google Analytics, and Fuse.js-powered search. It's automatically deployed to GitHub Pages via CI/CD pipeline on pushes to main.

## Repository Structure

- `archetypes/` - Content templates for creating new Hugo pages with front matter
- `assets/` - Processed assets directory (currently empty)
- `content/` - Multilingual content organized by language (en/fr) with pages for about, cv, and privacy
- `data/` - Data files for templates (currently empty)
- `i18n/` - Internationalization string files (currently empty)
- `layouts/` - Custom template overrides including partials and shortcodes
- `public/` - Generated static site output (gitignored)
- `resources/` - Hugo's generated cache and processed resources (gitignored)
- `static/` - Static assets served directly (images, favicons, PDFs)
- `themes/PaperMod/` - PaperMod theme as git submodule
- `config.yml` - Site configuration with bilingual settings, params, and theme options
- `Makefile` - Build and development commands
- `.github/workflows/hugo.yml` - CI/CD pipeline for GitHub Pages deployment

## Build & Development Commands

```bash
# Install/Initialize
make init                    # Initialize git submodules (theme)

# Development
make serve                   # Run local dev server at localhost:1313 with drafts
hugo server -D              # Alternative: run dev server directly
hugo server -D --disableFastRender  # Disable fast render for hot reload

# Build
make build                   # Build production site (with --gc --minify)
hugo --gc --minify          # Alternative: build production directly

# Debug/Check
make check                   # Run build with i18n warnings, template metrics, and hints

# Deployment
# Push to main triggers automatic GitHub Pages deployment via CI/CD
git push origin main

# Maintenance
make theme-update            # Update PaperMod submodule to latest upstream
git submodule update --remote --merge themes/PaperMod
```

## Code Style & Conventions

**Front Matter Format**
- Use TOML syntax with `+++` delimiters for page front matter
- YAML syntax (`---` delimiters) is also supported

**Content Files**
- Markdown format in `content/en/` or `content/fr/` directories
- Page type determined by directory placement (e.g., `about.md` creates `/about/`)

**Configuration**
- YAML format in `config.yml` following Hugo's configuration schema
- Language-specific settings under `languages.en` and `languages.fr`

**Templates**
- Go template syntax for Hugo layouts
- PaperMod theme templates in `themes/PaperMod/`
- Custom overrides in `layouts/partials/` and `layouts/shortcodes/`

**Git Conventions**
- Theme commits: `chore(theme): update PaperMod to vX.Y.Z`
- > TODO: Define commit message template for content/config changes

## Architecture Notes

```
┌─────────────────────────────────────────────────────────────────┐
│                     CI/CD (GitHub Actions)                       │
│                    Trigger: push to main                         │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Hugo Build Process                        │
│  Content → Templates + Theme → Static Assets → HTML/CSS/JS      │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Output: public/ Directory                     │
│              Deployed to GitHub Pages (fourat.dev)                │
└─────────────────────────────────────────────────────────────────┘
```

**Data Flow**
1. Content from `content/en/` or `content/fr/` is processed by Hugo
2. Templates from `layouts/` override theme templates from `themes/PaperMod/`
3. Static assets from `static/` are copied directly to output
4. Hugo renders final HTML/CSS/JS files to `public/`
5. CI/CD deploys `public/` to GitHub Pages

**Key Components**
- Hugo Extended: Static site generator with multilingual support
- PaperMod Theme: Responsive theme with profile mode, search, and analytics
- Custom Partials: `index_profile.html`, `extend_head.html`, `footer.html`, `header.html`
- Custom Shortcodes: `pdfReader.html`, `rawhtml.html`
- Fuse.js: Client-side search with JSON index output

## Testing Strategy

**Static Site Build**
```bash
make check                   # Validates templates and i18n
hugo --printI18nWarnings    # Check for i18n issues
```

**Local Preview**
```bash
make serve                   # Verify site renders correctly at localhost:1313
```

**CI/CD Pipeline**
- Build job runs on every push to main
- Uses Hugo Extended 0.149.0
- Tests build with `--gc --minify` flags
- Uploads `public/` artifact for deployment

> TODO: Add link checking (e.g., `htmltest`) for broken links
> TODO: Add visual regression testing for theme updates

## Security & Compliance

**Secrets Handling**
- No secrets committed to repository
- GitHub Analytics verification tag in `config.yml` is public-only
- Deployment uses GitHub Pages built-in authentication

**Dependency Scanning**
- Hugo theme updates via git submodule ( PaperMod)
- Theme updates should be reviewed manually before committing
- > TODO: Enable Dependabot for Hugo version updates

**Guardrails**
- `.gitignore` prevents committing generated files (`public/`, `resources/_gen/`)
- GitHub Actions permissions limited to `pages: write` and `id-token: write`
- No sensitive data in content or config files

**License**
- Content: Personal copyright
- PaperMod Theme: MIT License (via submodule)
- Hugo: Apache 2.0 License

## Agent Guardrails

**Files Never Modified**
- `themes/PaperMod/` - Always use git submodule, never edit directly
- `public/` - Generated directory, never commit changes

**Required Reviews**
- Theme updates (`make theme-update`) must be manually reviewed
- Changes to `config.yml` affecting production deployment should be verified
- Content additions in both languages required for bilingual parity

**Rate Limits**
- No automated deployment triggers (manual push to main only)
- Submodule updates should not be automated without review

**Content Boundaries**
- Do not add pages without corresponding translations in both languages
- Static assets (images, PDFs) must be placed in `static/`, not `public/`

## Extensibility Hooks

**Theme Customization Points**
- `layouts/partials/` - Override specific theme partials
- `layouts/shortcodes/` - Add custom shortcodes for content
- `static/` - Add custom assets (CSS, JS, images)

**Feature Flags**
- `buildDrafts: false` in `config.yml` - Control draft content rendering
- `enableRobotsTXT: true` - SEO control
- `math: true` - Enable KaTeX math rendering globally

**Environment Variables**
- `HUGO_CACHEDIR` - Cache directory for builds
- `HUGO_ENVIRONMENT: production` - Build environment
- `TZ: Europe/Paris` - Timezone for date processing

**New Page Creation**
```bash
hugo new content/en/new-page.md
# Edit content, then copy and translate to content/fr/new-page.md
```

## Further Reading

- `README.md` - Basic setup and usage instructions
- `project_spec.md` - Detailed project specification and architecture
- [Hugo Documentation](https://gohugo.io/documentation/)
- [PaperMod Theme Documentation](https://adityatelange.github.io/hugo-PaperMod/)
- `.github/workflows/hugo.yml` - CI/CD pipeline configuration
