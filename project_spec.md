# Project Specification: fourat.dev Personal Website

## Overview
**Project Name:** fourat.dev  
**Description:** Personal portfolio website for Fourat Mastouri, a Senior Data Engineer Consultant.  
**Purpose:** Showcase professional experience, skills, and contact information in a bilingual (English/French) format.  
**Type:** Static website built with Hugo static site generator.

## Technologies
- **Static Site Generator:** Hugo Extended ≥ 0.114.0
- **Theme:** PaperMod (Git submodule)
- **Languages:** English and French (i18n support)
- **Deployment:** GitHub Pages via GitHub Actions
- **Version Control:** Git with submodules

## Architecture
### Directory Structure
- `content/en|fr/`: Multilingual content pages (about, cv, privacy)
- `layouts/`: Custom template overrides, partials, and shortcodes
- `static/`: Static assets (images, PDFs, favicons)
- `themes/PaperMod/`: Theme submodule
- `config.yml`: Site configuration
- `.github/workflows/`: CI/CD pipeline for deployment

### Key Features
- **Profile Mode:** Landing page with photo, bio, and contact buttons
- **Bilingual Support:** Separate content directories for English/French
- **Responsive Design:** Mobile-friendly layout via PaperMod theme
- **SEO Optimized:** Meta tags, OpenGraph, Twitter Cards
- **Analytics:** Google Analytics integration
- **Search:** Fuse.js-powered site search
- **PDF Integration:** Embedded PDF viewer for resume/CV

## Content Pages
- **About:** Professional background and experience
- **CV/Resume:** Downloadable PDF in both languages
- **Privacy:** Privacy policy page

## Deployment Pipeline
- **Trigger:** Push to main branch
- **Build:** Hugo Extended builds static files to `public/`
- **Deploy:** GitHub Pages hosting
- **Automation:** Makefile for common tasks

## Configuration Highlights
- Profile mode enabled with custom subtitle and buttons
- Pagination set to 5 items per page
- Math rendering support (KaTeX)
- Syntax highlighting with Hugo Chroma
- Social icons (LinkedIn)
- Custom logo and branding

## Development Requirements
- Hugo Extended ≥ 0.114.0
- Git for submodule management
- Node.js (implied for any JS assets, though minimal)

## Maintenance
- Theme updates via `git submodule update --remote --merge`
- Content updates in respective language directories
- Static assets in `static/` folder

This specification outlines the current state and architecture of the fourat.dev personal website project.