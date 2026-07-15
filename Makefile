.PHONY: help init serve build check quality browser-smoke resume-pdfs clean theme-update docker-build docker-up docker-dev docker-down

HUGO ?= hugo
HUGO_CACHEDIR ?= /tmp/fourat-hugo-cache
CHECK_DESTINATION ?= /tmp/fourat-site-check

help:
	@echo "Available targets:"
	@echo "  init           - initialize the PaperMod submodule"
	@echo "  serve          - run the local Hugo development server"
	@echo "  build          - build the production site into public/"
	@echo "  check          - build to /tmp and validate generated routes/assets"
	@echo "  quality        - run build, link/metadata, and accessibility checks"
	@echo "  browser-smoke  - run responsive route checks in headless Chrome"
	@echo "  resume-pdfs    - regenerate tagged English and French résumé PDFs"
	@echo "  docker-build   - build the production container image"
	@echo "  docker-up      - run the production container at localhost:8080"
	@echo "  docker-dev     - run Hugo with live reload at localhost:1313"
	@echo "  docker-down    - stop Docker Compose services"
	@echo "  theme-update   - update the PaperMod submodule for manual review"
	@echo "  clean          - remove generated site and Hugo resources"

init:
	git submodule update --init --recursive

serve:
	HUGO_CACHEDIR=$(HUGO_CACHEDIR) $(HUGO) server -D --disableFastRender

build:
	HUGO_CACHEDIR=$(HUGO_CACHEDIR) $(HUGO) --gc --minify --panicOnWarning

check:
	rm -rf $(CHECK_DESTINATION)
	HUGO_CACHEDIR=$(HUGO_CACHEDIR) $(HUGO) --gc --minify --panicOnWarning --printI18nWarnings --printPathWarnings --destination $(CHECK_DESTINATION)
	python3 scripts/check_site.py $(CHECK_DESTINATION)

quality:
	./scripts/run_quality_checks.sh

browser-smoke:
	rm -rf /tmp/fourat-browser-site
	HUGO_CACHEDIR=$(HUGO_CACHEDIR) $(HUGO) --gc --minify --panicOnWarning --destination /tmp/fourat-browser-site
	node scripts/browser_smoke.mjs /tmp/fourat-browser-site

resume-pdfs:
	python3 scripts/generate_resume_pdfs.py

docker-build:
	docker build --tag fourat-dev:local .

docker-up:
	docker compose up --build --detach website

docker-dev:
	docker compose --profile dev up hugo-dev

docker-down:
	docker compose --profile dev down

clean:
	rm -rf public resources/_gen

theme-update:
	git submodule update --remote --merge themes/PaperMod
