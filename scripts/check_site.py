#!/usr/bin/env python3
"""Validate generated fourat.dev HTML and local asset references."""

from __future__ import annotations

import json
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlparse


class PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.refs: list[tuple[str, str, str]] = []
        self.metas: list[dict[str, str]] = []
        self.links: list[dict[str, str]] = []
        self.images: list[dict[str, str]] = []
        self.buttons: list[dict[str, str]] = []
        self.objects: list[dict[str, str]] = []
        self.ids: list[str] = []
        self.html_lang = ""
        self.h1_count = 0
        self.main_count = 0
        self.skip_links: list[str] = []
        self.json_ld_blocks: list[str] = []
        self.raw_schema_text: list[str] = []
        self._script_type: str | None = None
        self._script_data: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = {key: value or "" for key, value in attrs}
        if tag == "html":
            self.html_lang = values.get("lang", "")
        if tag == "h1":
            self.h1_count += 1
        if tag == "main":
            self.main_count += 1
        if tag == "meta":
            self.metas.append(values)
        if tag == "link":
            self.links.append(values)
        if tag == "img":
            self.images.append(values)
        if tag == "button":
            self.buttons.append(values)
        if tag == "object":
            self.objects.append(values)
        if tag == "script":
            self._script_type = values.get("type")
            self._script_data = []
        if tag == "a" and "skip-link" in values.get("class", "").split():
            self.skip_links.append(values.get("href", ""))
        if values.get("id"):
            self.ids.append(values["id"])
        for attr in ("href", "src", "data"):
            if values.get(attr):
                self.refs.append((tag, attr, values[attr]))

    def handle_data(self, data: str) -> None:
        if self._script_type == "application/ld+json":
            self._script_data.append(data)
        elif self._script_type is None and "https://schema.org" in data:
            self.raw_schema_text.append(data.strip())

    def handle_endtag(self, tag: str) -> None:
        if tag == "script":
            if self._script_type == "application/ld+json":
                self.json_ld_blocks.append("".join(self._script_data).strip())
            self._script_type = None
            self._script_data = []


def output_target(root: Path, url: str) -> list[Path]:
    parsed = urlparse(url)
    path = unquote(parsed.path)
    target = root / path.lstrip("/")
    candidates = [target]
    if path.endswith("/"):
        candidates.append(target / "index.html")
    elif not target.suffix:
        candidates.extend((target / "index.html", target.with_suffix(".html")))
    return candidates


def route_file(root: Path, route: str) -> Path:
    return root / route.lstrip("/") / "index.html" if route != "/" else root / "index.html"


def parse_page(path: Path) -> PageParser:
    parser = PageParser()
    parser.feed(path.read_text(encoding="utf-8", errors="replace"))
    return parser


def main() -> int:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else "public").resolve()
    errors: list[str] = []
    if not root.is_dir():
        print(f"Generated site directory does not exist: {root}", file=sys.stderr)
        return 2

    forbidden = (
        ".DS_Store",
        "index.json",
        "index.xml",
        "tags/index.html",
        "categories/index.html",
        "fr/tags/index.html",
        "fr/categories/index.html",
    )
    for relative in forbidden:
        if (root / relative).exists():
            errors.append(f"Forbidden generated artifact: /{relative}")

    expected = {
        "/": ("en-US", "index, follow"),
        "/about/": ("en-US", "index, follow"),
        "/cv/": ("en-US", "index, follow"),
        "/privacy/": ("en-US", "noindex, follow"),
        "/fr/": ("fr-FR", "index, follow"),
        "/fr/about/": ("fr-FR", "index, follow"),
        "/fr/cv/": ("fr-FR", "index, follow"),
        "/fr/privacy/": ("fr-FR", "noindex, follow"),
    }

    parsed_pages: dict[Path, PageParser] = {}
    for html_file in root.rglob("*.html"):
        parser = parse_page(html_file)
        parsed_pages[html_file] = parser
        relative = html_file.relative_to(root)
        duplicates = sorted({item for item in parser.ids if parser.ids.count(item) > 1})
        if duplicates:
            errors.append(f"{relative}: duplicate ids: {', '.join(duplicates)}")
        if relative.as_posix() not in ("404.html", "fr/404.html", "en/index.html") and parser.h1_count != 1:
            errors.append(f"{relative}: expected one h1, found {parser.h1_count}")
        if relative.as_posix() != "en/index.html" and parser.main_count != 1:
            errors.append(f"{relative}: expected one main landmark, found {parser.main_count}")
        if relative.as_posix() != "en/index.html" and "#main-content" not in parser.skip_links:
            errors.append(f"{relative}: missing skip link to #main-content")
        for image in parser.images:
            if "alt" not in image:
                errors.append(f"{relative}: image missing alt attribute: {image.get('src', '')}")
            if not image.get("width") or not image.get("height"):
                errors.append(f"{relative}: image missing intrinsic dimensions: {image.get('src', '')}")
        for button in parser.buttons:
            if not (button.get("aria-label") or button.get("title")):
                errors.append(f"{relative}: button missing an accessible label")
        for embedded_pdf in parser.objects:
            if embedded_pdf.get("type") == "application/pdf" and not (
                embedded_pdf.get("title") and embedded_pdf.get("aria-label")
            ):
                errors.append(f"{relative}: embedded PDF missing title or aria-label")
        viewports = [meta for meta in parser.metas if meta.get("name", "").lower() == "viewport"]
        if relative.as_posix() != "en/index.html" and not viewports:
            errors.append(f"{relative}: missing viewport metadata")
        if parser.raw_schema_text:
            errors.append(f"{relative}: schema JSON is visible outside an application/ld+json script")
        for block in parser.json_ld_blocks:
            try:
                json.loads(block)
            except json.JSONDecodeError as error:
                errors.append(f"{relative}: invalid JSON-LD: {error.msg}")
        for tag, attr, raw in parser.refs:
            url = urlparse(raw)
            if url.scheme not in ("", "http", "https"):
                continue
            if url.netloc not in ("", "fourat.dev", "www.fourat.dev", "127.0.0.1:4173"):
                continue
            if not url.path or url.path == "/":
                continue
            if not any(candidate.is_file() for candidate in output_target(root, raw)):
                errors.append(f"{relative}: missing local {tag} {attr} target {raw}")

    for route, (language, robots) in expected.items():
        path = route_file(root, route)
        if not path.is_file():
            errors.append(f"Missing expected route: {route}")
            continue
        parser = parsed_pages.get(path) or parse_page(path)
        if parser.html_lang != language:
            errors.append(f"{route}: expected lang={language}, found {parser.html_lang or 'missing'}")
        robot_values = [meta.get("content", "") for meta in parser.metas if meta.get("name", "").lower() == "robots"]
        if not robot_values or robot_values[-1] != robots:
            errors.append(f"{route}: expected final robots={robots}, found {robot_values}")
        descriptions = [meta.get("content", "").strip() for meta in parser.metas if meta.get("name", "").lower() == "description"]
        if not descriptions or not descriptions[-1]:
            errors.append(f"{route}: missing meta description")
        if not any(link.get("hreflang") == "x-default" for link in parser.links):
            errors.append(f"{route}: missing x-default hreflang")
        if not parser.json_ld_blocks:
            errors.append(f"{route}: missing JSON-LD structured data")

    translation_expectations = {
        "/about/": "/fr/about/",
        "/cv/": "/fr/cv/",
        "/fr/about/": "/about/",
        "/fr/cv/": "/cv/",
    }
    for route, expected_path in translation_expectations.items():
        parser = parsed_pages.get(route_file(root, route)) or parse_page(route_file(root, route))
        alternates = {urlparse(link.get("href", "")).path for link in parser.links if link.get("hreflang")}
        if expected_path not in alternates:
            errors.append(f"{route}: missing translated equivalent {expected_path}")

    not_found = root / "404.html"
    if not_found.is_file():
        parser = parsed_pages.get(not_found) or parse_page(not_found)
        robot_values = [meta.get("content", "") for meta in parser.metas if meta.get("name", "").lower() == "robots"]
        if not robot_values or robot_values[-1] != "noindex, follow":
            errors.append(f"/404.html: expected final robots=noindex, follow, found {robot_values}")

    if errors:
        print("Site validation failed:")
        for error in sorted(set(errors)):
            print(f"- {error}")
        return 1

    print(f"Validated {len(parsed_pages)} HTML files in {root}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
