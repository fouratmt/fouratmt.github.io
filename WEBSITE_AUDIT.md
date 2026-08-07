# fourat.dev Project Gap Analysis and Roadmap

**Last reviewed:** 2026-08-07

**Scope:** Product, content, UX, architecture, security, accessibility, SEO, quality, delivery, reliability, performance, monitoring, and developer experience

**Role of this document:** Single source of truth for completed work, remaining gaps, investigations, and deferred decisions

## How to use this document

This is the project's living backlog and replaces the earlier point-in-time website audit. Add newly discovered work here instead of creating separate TODO or roadmap files. Link issues and pull requests from the relevant item when they are created, and update each item's status as work progresses.

At the time of this review, the GitHub repository had no open issues or pull requests to merge into this backlog. The findings below were consolidated from the repository, generated site, production site, existing documentation, and current automated checks.

### Statuses

| Status | Meaning |
|---|---|
| **Completed** | Implemented and verified at the last review. |
| **In progress** | Work has started but its acceptance criteria are not yet met. |
| **Missing** | Confirmed gap with no complete implementation. |
| **Deferred** | Deliberately postponed; revisit when the stated trigger occurs. |
| **Investigation** | More evidence or an owner decision is required before implementation. |
| **Blocked** | The next action depends on access, another repository, or an external decision. |

### Priorities

| Priority | Meaning |
|---|---|
| **High** | Security, data-loss, accessibility, production correctness, or release-confidence risk. Address next. |
| **Medium** | Material improvement to usability, maintainability, discoverability, or operational quality. |
| **Low** | Useful polish or optimization with limited current impact. |

Priorities describe impact, not implementation effort. A blocked High item remains High.

## Executive summary

The site has a sound static architecture, a working bilingual experience, an automated quality gate, and client-side encrypted pages appropriate for GitHub Pages. The production build currently passes `make quality`, including protected-payload checks, Hugo rendering, generated-site validation, browser smoke tests, and the container build.

| Backlog snapshot | Count |
|---|---:|
| Completed baseline capabilities | 10 |
| Remaining tracked items | 67 |
| High / Medium / Low | 12 / 36 / 19 |
| Missing / Investigation / Blocked / Deferred | 49 / 15 / 2 / 1 |
| Known In progress | 0 |

The next work should concentrate on these risks:

1. **Prevent the local protected-page password from entering Docker build contexts** (`SEC-01`).
2. **Deploy and verify real production security headers** rather than relying on meta tags or local-container behavior (`SEC-02`).
3. **Fix HTTP URLs emitted in Open Graph and structured data on production** (`SEO-01`).
4. **Add authenticated verification, rotation, and recovery workflows for encrypted content** (`PROT-01` through `PROT-04`).
5. **Provide an accessible HTML résumé and remediate the untagged PDFs** (`ACC-01`, `ACC-02`).
6. **Add post-deployment verification and confirm repository protection/rollback controls** (`REL-01` through `REL-03`).

No work is known to be actively in progress outside this roadmap at the review date. When an item begins, its owner should mark it **In progress** and link the corresponding branch, issue, or pull request.

## Completed baseline

These capabilities are complete and should be protected from regression.

| ID | Status | Capability and evidence |
|---|---|---|
| BASE-01 | **Completed** | Bilingual English/French landing, About, CV, privacy, and protected Links routes with language switching. |
| BASE-02 | **Completed** | Responsive PaperMod-based visual identity with custom header, footer, profile, labels, social links, and image pipeline. |
| BASE-03 | **Completed** | Baseline SEO includes canonical links, Open Graph, schema markup, robots.txt, and sitemaps; unused taxonomy and search-index outputs are disabled. Remaining correctness gaps are tracked below. |
| BASE-04 | **Completed** | Accessible labels, focus styles, reduced-motion behavior, heading checks, image attributes, and color-contrast improvements are covered by generated-site or browser checks. |
| BASE-05 | **Completed** | Protected Hugo pages use encrypted payloads, a site-themed unlock screen, `noindex`, sitemap exclusion, stable payload identity across file renames, bilingual pairing, and documented authoring commands. |
| BASE-06 | **Completed** | The repository does not store the protected-page password; the supported sources are a local ignored file or environment variable. |
| BASE-07 | **Completed** | Pull requests run Hugo quality checks, protected-page verification, browser smoke coverage, and a Docker build. Pushes to `main` build and deploy through GitHub Pages. |
| BASE-08 | **Completed** | The local production-like container applies the documented security headers and supports a Docker Compose preview. This does not prove the same headers exist on production; see `SEC-02`. |
| BASE-09 | **Completed** | The privacy page describes the current static hosting and client-side protected-content behavior. External infrastructure assertions still require validation; see `PRIV-01`. |
| BASE-10 | **Completed** | `make quality` passed during this review with two encrypted payloads and 13 generated HTML pages. |

## Functional, content, and UX gaps

| ID | Status | Priority | Gap and rationale | Dependencies / blockers | Done when |
|---|---|---:|---|---|---|
| FUNC-01 | **Missing** | **High** | The résumé experience is PDF-first. A semantic bilingual HTML résumé would be easier to navigate, index, translate, and use with assistive technology. | Content source and bilingual parity; coordinate with `ACC-01`. | English and French HTML résumé pages expose the essential experience, skills, education, and contact information without requiring the PDF. |
| FUNC-02 | **Missing** | **Medium** | The portfolio describes capabilities but has no detailed case studies with constraints, decisions, measurable outcomes, and the author's role. This limits proof of expertise. | Select publishable work and remove client-confidential details. | At least two bilingual case studies are published with outcome-oriented evidence and a consistent template. |
| FUNC-03 | **Investigation** | **Medium** | Contact is currently a `mailto:` flow. A form or booking option may reduce friction, but would add spam, third-party, consent, and privacy obligations. | Owner decision; provider and data-retention review. | Either the existing approach is explicitly accepted and documented, or an accessible, spam-resistant bilingual flow is implemented and covered by the privacy policy. |
| FUNC-04 | **Missing** | **Medium** | Availability, employment summary, résumé PDFs, and professional claims can silently become stale. | Content owner and review cadence. | A documented quarterly or release-based content review records the last review date and checks all time-sensitive claims. |
| FUNC-05 | **Missing** | **Medium** | Creating a bilingual page requires manually creating and aligning two files. Protected pages add an additional encrypt/verify sequence. | Define naming and `translationKey` conventions. | A documented scaffold command creates matching EN/FR drafts with the expected front matter and clear next steps. |
| FUNC-06 | **Missing** | **Medium** | The protected-page prompt does not offer password visibility, Caps Lock guidance, a no-JavaScript explanation, or clearly differentiated download/decryption failures. These details affect recovery when unlock fails. | UX copy translations and browser tests. | The gate has accessible show/hide behavior, useful localized failure messages, a `<noscript>` fallback, and regression tests. |
| FUNC-07 | **Investigation** | **Low** | Search and a blog are mentioned in older project documentation, but current output intentionally disables search and the site has little searchable content. Adding them now may create needless complexity. | Product/content strategy decision. | The features are either removed from project claims as intentionally out of scope or added once content volume justifies them. |
| FUNC-08 | **Missing** | **Low** | The 404 experience uses the theme default and does not guide visitors to primary bilingual destinations. | Final copy and design review. | The 404 page offers clear Home, About, CV, and language navigation while preserving the site's identity. |
| FUNC-09 | **Deferred** | **Medium** | Some compact interactive elements do not consistently reach a 44×44 CSS-pixel touch target. The owner previously chose not to increase their visual footprint. | Revisit after mobile feedback or an accessibility review. | Touch targets meet the chosen accessibility target without harming the intended header layout. |
| FUNC-10 | **Investigation** | **Low** | Testimonials, client logos, or other third-party proof may improve credibility, but require permission and can create maintenance/privacy work. | Written permission and content strategy. | A decision is recorded; approved proof is bilingual, accurate, and attributed, or the feature is explicitly out of scope. |

## Protected-content, security, and privacy gaps

| ID | Status | Priority | Gap and rationale | Dependencies / blockers | Done when |
|---|---|---:|---|---|---|
| SEC-01 | **Missing** | **High** | `.protected-pages-password` is ignored by Git but is not excluded by `.dockerignore`. Because the build stage copies the repository, a local password can enter the Docker build context, intermediate layer, or cache. | None. Preserve the final image behavior and test local builds. | The password file and other plaintext recovery artifacts are excluded from all container contexts; a regression check fails if they are included. |
| SEC-02 | **Blocked** | **High** | Production responses were verified without CSP, Permissions Policy, Referrer Policy, X-Content-Type-Options, or frame-protection headers. The documented Cloudflare configuration has not been applied or cannot be confirmed. Meta CSP is only a partial fallback. | Cloudflare account/configuration access and an owner-approved policy. | Headers are applied at the production edge, tested on representative HTML/assets, and checked automatically after deployment. |
| SEC-03 | **Missing** | **Medium** | The current meta CSP permits inline script/style behavior required by theme overrides. This weakens script-injection protection even after an edge header is added. | Inventory and migrate inline theme/custom code; test analytics and protected unlock flow. | Inline code is removed, hashed, or nonced as appropriate, and a stricter enforced CSP produces no violations in supported flows. |
| SEC-04 | **Missing** | **Medium** | CI has no dedicated secret scanner. Git ignore rules reduce accidental commits but do not detect renamed passwords, plaintext drafts, or leaked credentials. | Select a scanner and tune false positives for encrypted payloads. | Pull requests and repository history are scanned with a documented response procedure. |
| SEC-05 | **Missing** | **Medium** | Dependency and static-analysis coverage is incomplete: Dependabot covers Actions but the npm entry has no manifest to inspect, and there is no CodeQL or equivalent scan for scripts. | Decide proportionate tooling for a small static site. | Active dependency surfaces are scanned, ineffective configuration is removed, and findings have an owner workflow. |
| SEC-06 | **Investigation** | **Low** | Client-side ciphertext can be copied and attacked offline. PBKDF2 at 600,000 iterations is reasonable, but actual latency and resistance have not been calibrated across target mobile devices; Argon2/WASM would add complexity. | Threat model, browser support, performance measurements, and payload format migration plan. | The threat model and benchmark are documented; the KDF is retained with evidence or upgraded with backward compatibility. |
| PRIV-01 | **Investigation** | **Medium** | The privacy text makes statements involving GitHub Pages and Cloudflare, but actual Cloudflare analytics, logs, retention, cookies, and edge rules were not available for this review. | Cloudflare settings access; legal review if required. | Production behavior and policy text agree, retention/processors are recorded, and inaccuracies are corrected. |
| PRIV-02 | **Investigation** | **Low** | The site intentionally has no behavioral analytics. It is unclear whether basic privacy-preserving usage or conversion data is needed. | Owner decision; update consent/privacy obligations if a provider is chosen. | “No analytics” is recorded as the deliberate policy, or a minimal compliant solution is implemented and disclosed. |
| PRIV-03 | **Missing** | **Low** | Repository code and site content do not have an explicit licensing policy, creating ambiguity about reuse. | Owner selects code and content licenses. | The repository states applicable licenses and distinguishes reusable code from copyrighted personal content. |

## Protected-page lifecycle and data-recovery gaps

| ID | Status | Priority | Gap and rationale | Dependencies / blockers | Done when |
|---|---|---:|---|---|---|
| PROT-01 | **Missing** | **High** | `verify` validates the encrypted envelope and references but does not authenticate/decrypt the real payload. Browser tests substitute a temporary fixture, so corrupted production ciphertext or a mismatched password can pass CI. | CI must not receive the real password. Define a safe local/owner-only verification mode. | A password-aware local command decrypts every real payload, validates its structure/content, and fails clearly; CI separately tests deterministic fixtures without the production password. |
| PROT-02 | **Missing** | **High** | There is no atomic command to change the shared password across all pages. Manual recovery/re-encryption can leave a mixed-password site or lose edits. | Password custody and backup strategy. | A rekey command decrypts all pages first, writes nothing on partial failure, rotates all payloads, verifies them, and documents rollback. |
| PROT-03 | **Missing** | **High** | The password is the only practical key to encrypted source content; loss or corruption can make the content unrecoverable. Recovery depends on manually managed local plaintext backups. | Owner chooses an offline password/backup manager and acceptable recovery location. | A restore drill proves recovery from the chosen backup without committing plaintext or secrets. |
| PROT-04 | **Missing** | **Medium** | Failed edit operations preserve plaintext drafts in temporary storage for safety, but cleanup is manual and the retention risk is easy to miss. | Cross-platform temp-file behavior and recovery UX. | The command reports exact recovery/cleanup actions, supports safe cleanup after confirmation, and documentation explains the exposure window. |
| PROT-05 | **Missing** | **Medium** | There is no full automated lifecycle test for create, protect, unlock, edit, recover, rename, translation pairing, delete, orphan detection, and rekey. | Use disposable content and a disposable test password. | A test suite covers successful and failure paths without reading the owner's password or modifying real content. |
| PROT-06 | **Missing** | **Medium** | Encrypted rendered HTML can become stale after shortcode, layout, URL, or sanitizer changes because the plaintext source is unavailable during a normal build. | Define a content/payload format version and owner-only migration workflow. | Payload metadata records relevant format/version data and a command can identify and re-render all stale pages after an intentional unlock. |
| PROT-07 | **Missing** | **Low** | Verification detects orphan files and path mismatches but does not explicitly reject multiple pages referencing the same payload. | Clarify whether shared payloads will ever be supported. | Duplicate references either fail verification or are an explicitly documented supported feature. |
| PROT-08 | **Investigation** | **Low** | One shared default password is simple but increases blast radius and prevents selective sharing/revocation. Per-page passwords increase key-management burden. | Owner's sharing model and expected page count. | The shared-password model is explicitly accepted, or page/key grouping is designed with migration and recovery support. |

## Accessibility gaps

| ID | Status | Priority | Gap and rationale | Dependencies / blockers | Done when |
|---|---|---:|---|---|---|
| ACC-01 | **Missing** | **High** | Essential résumé information is not available as structured HTML. Embedded/downloaded PDFs are a weaker primary experience for screen readers, reflow, mobile zoom, translation, and search. | Same implementation as `FUNC-01`. | A keyboard- and screen-reader-usable bilingual HTML résumé is the primary route; PDF remains an optional download. |
| ACC-02 | **Blocked** | **High** | Both résumé PDFs are untagged, lack document title/author metadata, and are not optimized. Remediation belongs in the external LaTeX résumé source. | Access and changes in the résumé repository; then replace both site assets. | Automated PDF inspection reports tags and metadata, reading order is manually checked, and EN/FR downloads are refreshed. |
| ACC-03 | **Missing** | **Medium** | Automated checks cover selected semantics but not a complete WCAG-oriented scan. There is no axe integration or documented manual assistive-technology pass. | Choose target WCAG level and supported browser/screen-reader combinations. | CI runs an accessibility scanner on representative public/protected states and a manual checklist covers keyboard, zoom/reflow, VoiceOver/NVDA, and mobile. |
| ACC-04 | **Missing** | **Medium** | Browser smoke coverage is Chromium-only, leaving focus, PDF embedding, and crypto behavior unverified in Firefox and Safari/WebKit. | CI runtime and supported-browser policy. | Critical public and unlock flows pass in Chromium, Firefox, and WebKit or exclusions are documented with evidence. |
| ACC-05 | **Investigation** | **Low** | The site has not been evaluated at 200–400% zoom, forced-colors/high-contrast modes, or with user stylesheet overrides. | Manual test capacity; coordinate with `ACC-03`. | Results and required fixes are recorded against the chosen accessibility standard. |

## SEO and discoverability gaps

| ID | Status | Priority | Gap and rationale | Dependencies / blockers | Done when |
|---|---|---:|---|---|---|
| SEO-01 | **Missing** | **High** | Production Open Graph and JSON-LD URLs currently use `http://fourat.dev/...` while canonical URLs are HTTPS. This can split identity signals and produce incorrect shared metadata. | Determine whether the GitHub Pages base URL or Cloudflare rewriting causes the scheme mismatch. | Generated source and production HTML use HTTPS consistently for canonical, alternate, Open Graph, sitemap, and structured-data URLs; CI asserts this. |
| SEO-02 | **Investigation** | **Medium** | Search Console ownership, sitemap submission, indexing coverage, redirects, and rich-result status were not available. Local markup alone cannot prove search-engine behavior. | Search Console access. | Both language sitemaps and important routes are monitored, exclusions are intentional, and errors have an owner. |
| SEO-03 | **Missing** | **Medium** | Schema markup exists but its page types and multilingual relationships have not been validated against current content, especially the CV/ProfilePage semantics. | Validate generated production JSON-LD with authoritative tools. | Representative routes pass schema validation and use stable HTTPS identifiers and correct language relationships. |
| SEO-04 | **Missing** | **Medium** | Future pages can regress titles, descriptions, canonicals, language alternates, or sitemap exclusion because checks cover only selected expected routes. | Expand generated-site tests without overfitting content. | Every indexable page meets generic metadata rules and every protected/non-indexable page is absent from sitemap/search outputs. |
| SEO-05 | **Investigation** | **Low** | Redirect behavior for legacy paths, trailing slashes, host variants, and HTTP-to-HTTPS was sampled but is not codified. | Cloudflare/GitHub Pages settings. | A redirect matrix is documented and automatically sampled in production. |

## Testing and quality gaps

| ID | Status | Priority | Gap and rationale | Dependencies / blockers | Done when |
|---|---|---:|---|---|---|
| TEST-01 | **Missing** | **High** | There is no post-deployment smoke test. CI can report a successful upload while production serves wrong headers, stale content, bad metadata, or a broken custom domain. | Workflow sequencing and safe retry policy. | After deployment, representative EN/FR public and protected routes, assets, HTTPS metadata, headers, and robots/sitemaps are checked; failure alerts the owner. |
| TEST-02 | **Missing** | **Medium** | The generated-site checker validates internal assets but not external links, redirects, fragments, or downloadable-file health. Link rot will otherwise be discovered by visitors. | Select a rate-limited link checker and allowlist intentional exceptions. | Scheduled or PR checks validate internal links/fragments and periodically validate external links with useful reports. |
| TEST-03 | **Missing** | **Medium** | There is no HTML conformance check, so invalid nesting, duplicate IDs, or malformed metadata can pass the current custom assertions. | Select validator and suppress only understood theme issues. | Generated HTML passes an automated conformance check on representative/all routes. |
| TEST-04 | **Missing** | **Medium** | Bilingual parity rules are partly hard-coded. New public routes can be added in only one language without a general failure. | Define legitimate single-language exceptions. | CI compares translation groups/routes generically and reports missing or inconsistent language counterparts. |
| TEST-05 | **Missing** | **Medium** | No visual-regression baseline covers header, landing, content, protected locked/unlocked states, or responsive breakpoints. Theme and CSS upgrades can silently alter identity. | Stable fonts/browser rendering and an intentional baseline-review process. | Approved screenshots are compared at representative desktop/mobile breakpoints with actionable diffs. |
| TEST-06 | **Missing** | **Medium** | Unit coverage for JavaScript/Python helpers is limited; most confidence comes from end-to-end scripts, making edge cases slower to diagnose. | Decide lightweight test runners without unnecessary dependencies. | Parsing, identity calculation, crypto-envelope validation, front matter, and route rules have focused unit tests. |
| TEST-07 | **Missing** | **Low** | Resume asset checks verify presence but not freshness, metadata, tagging, language, or content sanity. | Coordinate with external résumé source. | Automated checks flag stale or inaccessible PDF artifacts and record the expected upstream version/date. |

## CI/CD, reliability, and monitoring gaps

| ID | Status | Priority | Gap and rationale | Dependencies / blockers | Done when |
|---|---|---:|---|---|---|
| REL-01 | **Investigation** | **High** | Branch protection, required checks, environment approvals, and least-privilege repository settings were not visible in the repository files. A broken or unreviewed push to `main` may deploy immediately. | GitHub repository administration access and owner policy. | Required checks/reviews, force-push/deletion rules, deployment environment protections, and permissions are documented and verified. |
| REL-02 | **Missing** | **High** | There is no explicit rollback or incident runbook for a bad Pages deployment, compromised dependency, custom-domain problem, or lost protected-page password. | Identify responsible owner and acceptable recovery time. | A short tested runbook covers rollback to a known commit, Pages/Cloudflare diagnosis, password/content recovery, and communication. |
| REL-03 | **Missing** | **Medium** | No uptime, certificate/domain-expiry, deployment-failure, or critical-route monitoring is documented. Static hosting is reliable, but failures can remain unnoticed. | Select a low-maintenance monitor and notification channel. | External checks cover HTTPS, core routes, and certificate/domain health and notify the owner with a tested escalation path. |
| REL-04 | **Missing** | **Medium** | Deployment rebuilds and reruns quality work already performed in the check workflow. This adds latency and allows slightly different environments to produce the deployed artifact. | Decide whether to promote an immutable verified artifact or retain defense-in-depth rebuilds. | The delivery design is documented; ideally the exact verified artifact is deployed with provenance and retention. |
| REL-05 | **Missing** | **Medium** | Actions and container bases use mutable version tags rather than immutable commit SHAs/digests. Upstream changes can alter builds without a repository diff. | Dependabot/Renovate strategy for digest updates. | Third-party Actions are pinned to reviewed SHAs and important images to digests, with automated update proposals. |
| REL-06 | **Missing** | **Low** | Workflow timeouts, concurrency/cancellation policy, artifact retention, and cache strategy are not consistently explicit. Stuck or duplicate runs can waste resources and obscure the latest result. | Observe normal build duration and cache safety. | Workflows define sensible timeouts, cancel superseded runs, and document artifact/cache behavior. |
| REL-07 | **Investigation** | **Low** | Disaster recovery for the custom domain, DNS configuration, Cloudflare rules, and GitHub Pages settings is not documented as code or exportable configuration. | Cloudflare and registrar access; avoid storing sensitive account data. | Critical external settings have a secure inventory/export and can be reconstructed by the owner. |

## Architecture and technical-debt gaps

| ID | Status | Priority | Gap and rationale | Dependencies / blockers | Done when |
|---|---|---:|---|---|---|
| ARCH-01 | **Missing** | **Medium** | The Hugo version is repeated in `.hugo-version`, workflows, Dockerfile, and Compose configuration. Version drift can make local, CI, and container results differ. | Choose one machine-readable source and update consumers. | A single declared Hugo version drives all supported build environments and a check detects drift. |
| ARCH-02 | **Missing** | **Medium** | Project documentation is stale in places: it still claims active Fuse.js search/analytics behavior, an older Hugo baseline, and an emptier architecture than the current encrypted-page/test/container system. | Update `project_spec.md`, `AGENTS.md`, and README after roadmap priorities settle. | Documentation accurately reflects current routes, tooling, security boundaries, and supported commands without contradictory claims. |
| ARCH-03 | **Missing** | **Medium** | Custom PaperMod overrides depend on theme internals, but there is no compatibility checklist or automated diff review when the submodule changes. | Define supported theme update cadence. | Theme updates trigger focused visual, accessibility, and override compatibility checks with documented manual review. |
| ARCH-04 | **Investigation** | **Medium** | Protected-page payload identity, crypto envelope, and rendered-content format are bespoke protocols without a versioned design note/ADR. Future migrations risk backward incompatibility. | Document current invariants before changing format. | An ADR records threat model, key derivation, payload/version semantics, rename rules, limitations, and migration strategy. |
| ARCH-05 | **Missing** | **Low** | Repeated language-specific labels and protected-page strings can drift between templates, scripts, tests, and documentation. | Decide whether Hugo i18n files or a data file should own them. | User-facing strings have a clear source of truth and missing translations fail validation. |
| ARCH-06 | **Investigation** | **Low** | The repository contains an npm Dependabot configuration but no `package.json`; browser tooling is invoked through external commands. The intended JavaScript dependency model is unclear. | Decide between zero-manifest tooling and a pinned dev-tool manifest. | The chosen model is documented and reproducible; ineffective automation is removed. |

## Performance gaps

| ID | Status | Priority | Gap and rationale | Dependencies / blockers | Done when |
|---|---|---:|---|---|---|
| PERF-01 | **Missing** | **Medium** | There are no Lighthouse/Core Web Vitals budgets. Current pages are small, but image, font, theme, or script changes can regress performance unnoticed. | Select representative routes and realistic mobile thresholds. | CI or scheduled tests track LCP, CLS, INP proxies, accessibility, and asset budgets with reviewed thresholds. |
| PERF-02 | **Investigation** | **Medium** | No field performance data exists, so laboratory scores may not represent visitors, locations, or device constraints. | Depends on the analytics/privacy decision in `PRIV-02`. | Either field measurement is explicitly out of scope, or a privacy-compatible RUM approach reports enough aggregate data to guide work. |
| PERF-03 | **Missing** | **Low** | Production cache-control, compression, CDN behavior, and immutable asset caching are not automatically verified. | Cloudflare/GitHub Pages behavior and header access. | A production check records cache/compression expectations and flags regressions without caching sensitive plaintext (which should never exist server-side). |
| PERF-04 | **Missing** | **Low** | The PDFs are not linearized/optimized and may be heavier or slower than necessary on mobile, although their current size is modest. | External résumé source and `ACC-02`. | Updated PDFs preserve quality/accessibility while passing size and optimization expectations. |

## Developer experience and governance gaps

| ID | Status | Priority | Gap and rationale | Dependencies / blockers | Done when |
|---|---|---:|---|---|---|
| DX-01 | **Missing** | **Medium** | README requirements omit Node.js even though protected-page tooling and browser tests require it. There is no `.nvmrc`, Volta, or equivalent supported toolchain declaration. | Choose supported Node version aligned with CI. | A fresh-machine setup documents and verifies Hugo, Node, browser, Docker, and submodule requirements. |
| DX-02 | **Missing** | **Medium** | There is no unified lint/format policy for JavaScript, Python, YAML, Markdown, shell, Hugo templates, or Makefile changes. Build checks catch behavior but not many maintainability errors. | Keep tooling proportionate and pin versions. | `make lint` (or equivalent) runs documented format/lint checks locally and in CI. |
| DX-03 | **Missing** | **Medium** | Contribution workflow, commit conventions, review expectations, release/deployment steps, and ownership are incomplete or marked TODO in project guidance. | Owner preferences. | A concise contributing guide covers branches, commits, bilingual content, protected data, validation, review, and deployment. |
| DX-04 | **Missing** | **Medium** | There is no automated documentation drift check for commands, routes, Hugo version, or protected front matter examples. | Decide which facts can be generated/asserted. | CI validates key documented commands/examples or documentation is generated from machine-readable sources. |
| DX-05 | **Missing** | **Low** | Changelog/release notes are not maintained. For a personal site, Git history may be enough, but security and encrypted-format migrations need an audit trail. | Choose lightweight release policy. | Material operational/security changes are recorded in releases, a changelog, or dated ADRs. |
| DX-06 | **Missing** | **Low** | There is no issue template that maps proposed work to this roadmap's IDs, priority, status, dependencies, and acceptance criteria. | Only useful if GitHub Issues becomes the execution layer. | Issue/PR templates link roadmap IDs and require relevant quality/security considerations, or the project explicitly keeps roadmap-only tracking. |

## Assumptions and investigation register

The following conclusions should not be treated as verified facts until their owners supply the missing evidence.

| ID | Assumption or unknown | Required evidence / owner |
|---|---|---|
| INV-01 | Cloudflare is in front of production, but the active response-header, cache, redirect, log, analytics, and retention configuration is unknown. | Cloudflare dashboard/export and production header tests. |
| INV-02 | GitHub branch protection, rulesets, Pages environment protection, and repository security settings may exist outside version control. | Repository administrator review. |
| INV-03 | Search Console and search-engine indexing health may already be monitored elsewhere. | Search Console access and sitemap/index coverage export. |
| INV-04 | The external résumé/LaTeX repository is the authoritative source for both PDFs and may have its own backlog. | Inspect that repository before changing PDF generation. |
| INV-05 | One shared protected-page password matches the intended audience and sharing model. | Owner confirms whether selective sharing/revocation is required. |
| INV-06 | No analytics is currently an intentional privacy choice rather than an unfinished integration. | Owner records the desired measurement policy. |
| INV-07 | The website's primary success criterion is professional credibility/contact rather than publishing, lead capture, or audience growth. | Define target audiences and measurable outcomes before adding product features. |
| INV-08 | The production checks in this review are a snapshot from 2026-08-07, not continuous proof. | Implement `TEST-01` and `REL-03`. |

This review was not a legal opinion, penetration test, full assistive-technology audit, or field-performance study. Those limitations explain several Investigation items rather than implying that the underlying controls are absent.

## Recommended delivery sequence

### Milestone 1 — Close immediate exposure and correctness risks

1. `SEC-01`: remove local secrets from Docker contexts and add regression protection.
2. `SEO-01`: make all public identity/metadata URLs consistently HTTPS.
3. `SEC-02`: deploy and verify production edge headers.
4. `PROT-01`, `PROT-02`, `PROT-03`: authenticate real payloads locally, add atomic rekey, and prove recovery.
5. `TEST-01`: verify the actual production deployment.

### Milestone 2 — Make essential content accessible and resilient

1. `FUNC-01` / `ACC-01`: publish the bilingual HTML résumé.
2. `ACC-02`: regenerate tagged, metadata-complete PDFs from the external source.
3. `ACC-03`, `ACC-04`: broaden automated and manual accessibility/browser coverage.
4. `REL-01`, `REL-02`: confirm repository protections and test rollback/recovery.

### Milestone 3 — Strengthen maintainability and release confidence

1. `PROT-05`, `PROT-06`: lifecycle tests and versioned encrypted-content migrations.
2. `TEST-02` through `TEST-06`: links, conformance, parity, visuals, and focused unit tests.
3. `ARCH-01` through `ARCH-04`: consolidate versions, refresh architecture docs, guard theme overrides, and record the protected-content ADR.
4. `DX-01` through `DX-04`: reproducible setup, linting, contribution guidance, and drift checks.

### Milestone 4 — Grow the portfolio based on evidence

1. Define audience and success criteria (`INV-07`).
2. Add case studies (`FUNC-02`) and choose the contact flow (`FUNC-03`).
3. Decide analytics/field measurement (`PRIV-02`, `PERF-02`).
4. Add performance budgets and operational monitoring (`PERF-01`, `REL-03`).
5. Reassess deferred search, blog, testimonials, touch targets, and other polish based on actual visitor needs.

## Maintenance rules

- Update **Last reviewed** whenever the whole backlog is reconciled with code, production, and GitHub Issues/PRs.
- Every new item must include an ID, status, priority, rationale, dependency/blocker, and testable completion condition.
- Do not mark an item Completed based only on code presence; verify its acceptance condition in the appropriate environment.
- If execution moves to GitHub Issues, keep this document as the summary and link each active issue instead of copying divergent descriptions.
- Record deliberate non-goals as Deferred or Investigation so they are not repeatedly rediscovered as accidental omissions.
- Move obsolete items to a dated archive only when this document becomes difficult to scan; retain completed architectural/security decisions in ADRs or release notes.
