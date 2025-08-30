.PHONY: help init serve build clean theme-update check

HUGO ?= hugo

help:
	@echo "Available targets:"
	@echo "  init           - init/update git submodules"
	@echo "  serve          - run local dev server (with drafts)"
	@echo "  build          - build production site (public/)"
	@echo "  clean          - remove build and generated resources"
	@echo "  theme-update   - update PaperMod submodule to latest"
	@echo "  check          - run a basic build with extra logging"

init:
	git submodule update --init --recursive

serve:
	$(HUGO) server -D --disableFastRender

build:
	$(HUGO) --gc --minify

clean:
	rm -rf public resources/_gen

theme-update:
	git submodule update --remote --merge themes/PaperMod

check:
	$(HUGO) --printI18nWarnings --templateMetrics --templateMetricsHints

