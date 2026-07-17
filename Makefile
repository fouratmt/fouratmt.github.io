.PHONY: help check-hugo init serve build check quality browser-smoke clean theme-update docker-check docker-build docker-up docker-dev docker-down

HUGO ?= hugo
HUGO_VERSION := $(shell tr -d '[:space:]' < .hugo-version)
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
	@echo "  docker-check   - validate the Docker Compose configuration"
	@echo "  docker-build   - build the local NGINX preview image"
	@echo "  docker-up      - run the local NGINX preview at localhost:8080"
	@echo "  docker-dev     - run Hugo with live reload at localhost:1313"
	@echo "  docker-down    - stop Docker Compose services"
	@echo "  theme-update   - update the PaperMod submodule for manual review"
	@echo "  clean          - remove generated site and Hugo resources"

check-hugo:
	@version="$$($(HUGO) version 2>/dev/null || true)"; \
	case "$$version" in *"v$(HUGO_VERSION)"*) ;; \
	  *) echo "Hugo $(HUGO_VERSION) is required; found: $${version:-not installed}" >&2; exit 1 ;; esac; \
	case "$$version" in *"+extended"*) ;; \
	  *) echo "Hugo Extended is required; found: $${version:-not installed}" >&2; exit 1 ;; esac

init:
	git submodule update --init --recursive

serve: check-hugo
	HUGO_CACHEDIR=$(HUGO_CACHEDIR) $(HUGO) server -D --disableFastRender

build: check-hugo
	HUGO_CACHEDIR=$(HUGO_CACHEDIR) $(HUGO) --gc --minify --panicOnWarning

check: check-hugo
	rm -rf $(CHECK_DESTINATION)
	HUGO_CACHEDIR=$(HUGO_CACHEDIR) $(HUGO) --gc --minify --panicOnWarning --printI18nWarnings --printPathWarnings --destination $(CHECK_DESTINATION)
	python3 scripts/check_site.py $(CHECK_DESTINATION)

quality: check-hugo
	./scripts/run_quality_checks.sh

browser-smoke: check-hugo
	rm -rf /tmp/fourat-browser-site
	HUGO_CACHEDIR=$(HUGO_CACHEDIR) $(HUGO) --gc --minify --panicOnWarning --destination /tmp/fourat-browser-site
	node scripts/browser_smoke.mjs /tmp/fourat-browser-site

docker-check:
	docker compose config --quiet

docker-build: docker-check
	docker build --tag fourat-dev:local .

docker-up: docker-check
	docker compose up --build --detach website

docker-dev: docker-check
	docker compose --profile dev up hugo-dev

docker-down:
	docker compose --profile dev down

clean:
	rm -rf public resources/_gen

theme-update:
	git submodule update --remote --merge themes/PaperMod
