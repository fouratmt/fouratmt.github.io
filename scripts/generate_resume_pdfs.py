#!/usr/bin/env python3
"""Generate readable, tagged résumé PDFs from the bilingual Markdown pages."""

from __future__ import annotations

import re
import shutil
from collections import defaultdict
from html import escape
from pathlib import Path

from pypdf import PdfWriter
from pypdf.generic import (
    ArrayObject,
    BooleanObject,
    DictionaryObject,
    NameObject,
    NumberObject,
    TextStringObject,
)
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "output" / "pdf"
STATIC_DIR = ROOT / "static"


class TaggedCanvas(canvas.Canvas):
    """Canvas that records marked-content IDs for the structure tree."""

    def __init__(self, *args, language: str, **kwargs):
        super().__init__(*args, **kwargs)
        self.language = language
        self.tags_by_page: dict[int, list[tuple[int, str]]] = defaultdict(list)
        self._next_mcid = 0
        self.setAuthor("Fourat Mastouri")
        self.setCreator("fourat.dev résumé generator")

    def begin_tag(self, role: str) -> None:
        mcid = self._next_mcid
        self._next_mcid += 1
        self.tags_by_page[self._pageNumber - 1].append((mcid, role))
        self._code.append(f"/{role} <</MCID {mcid}>> BDC")

    def end_tag(self) -> None:
        self._code.append("EMC")

    def showPage(self) -> None:  # noqa: N802 - ReportLab API
        super().showPage()
        self._next_mcid = 0


class TaggedParagraph(Paragraph):
    def __init__(self, text: str, style: ParagraphStyle, role: str = "P"):
        self.tag_role = role
        super().__init__(text, style)

    def drawOn(self, canv: TaggedCanvas, x: float, y: float, _sW: float = 0) -> None:  # noqa: N803
        canv.begin_tag(self.tag_role)
        try:
            super().drawOn(canv, x, y, _sW)
        finally:
            canv.end_tag()


def inline_markup(value: str) -> str:
    value = escape(value.strip())
    value = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", value)
    value = re.sub(r"_(.+?)_", r"<i>\1</i>", value)
    value = value.replace("`", "")
    return value


def markdown_blocks(path: Path) -> list[tuple[str, str]]:
    lines = path.read_text(encoding="utf-8").splitlines()
    if lines and lines[0] == "---":
        lines = lines[lines[1:].index("---") + 2 :]

    blocks: list[tuple[str, str]] = []
    paragraph: list[str] = []
    in_raw_html = False

    def flush() -> None:
        if paragraph:
            blocks.append(("P", inline_markup(" ".join(paragraph))))
            paragraph.clear()

    for raw_line in lines:
        line = raw_line.strip()
        if line in ("{{< rawhtml >}}", "{{< /rawhtml >}}"):
            flush()
            in_raw_html = not in_raw_html
            continue
        if in_raw_html or line.startswith("{{< pdfReader"):
            continue
        if not line:
            flush()
            continue
        if line.startswith("### "):
            flush()
            blocks.append(("H3", inline_markup(line[4:])))
        elif line.startswith("## "):
            flush()
            blocks.append(("H2", inline_markup(line[3:])))
        elif line.startswith("- "):
            flush()
            blocks.append(("P", f"•&nbsp;&nbsp;{inline_markup(line[2:])}"))
        else:
            paragraph.append(line)
    flush()
    return blocks


def tag_pdf(source: Path, destination: Path, tags_by_page: dict[int, list[tuple[int, str]]], language: str, metadata: dict[str, str]) -> None:
    writer = PdfWriter(clone_from=str(source))
    struct_root = DictionaryObject({NameObject("/Type"): NameObject("/StructTreeRoot")})
    struct_root_ref = writer._add_object(struct_root)
    root_kids = ArrayObject()
    parent_tree_numbers = ArrayObject()

    for page_index, page in enumerate(writer.pages):
        page[NameObject("/StructParents")] = NumberObject(page_index)
        page[NameObject("/Tabs")] = NameObject("/S")
        parent_array = ArrayObject()
        for mcid, role in tags_by_page.get(page_index, []):
            element = DictionaryObject(
                {
                    NameObject("/Type"): NameObject("/StructElem"),
                    NameObject("/S"): NameObject(f"/{role}"),
                    NameObject("/P"): struct_root_ref,
                    NameObject("/Pg"): page.indirect_reference,
                    NameObject("/K"): NumberObject(mcid),
                }
            )
            element_ref = writer._add_object(element)
            root_kids.append(element_ref)
            parent_array.append(element_ref)
        parent_tree_numbers.extend((NumberObject(page_index), writer._add_object(parent_array)))

    parent_tree = DictionaryObject({NameObject("/Nums"): parent_tree_numbers})
    struct_root[NameObject("/K")] = root_kids
    struct_root[NameObject("/ParentTree")] = writer._add_object(parent_tree)
    struct_root[NameObject("/ParentTreeNextKey")] = NumberObject(len(writer.pages))
    writer._root_object[NameObject("/StructTreeRoot")] = struct_root_ref
    writer._root_object[NameObject("/MarkInfo")] = DictionaryObject({NameObject("/Marked"): BooleanObject(True)})
    writer._root_object[NameObject("/Lang")] = TextStringObject(language)
    writer._root_object[NameObject("/ViewerPreferences")] = DictionaryObject(
        {NameObject("/DisplayDocTitle"): BooleanObject(True)}
    )
    writer.add_metadata(
        {
            "/Title": metadata["title"],
            "/Author": "Fourat Mastouri",
            "/Subject": metadata["subject"],
            "/Keywords": "data engineering, Python, Spark, data platforms, consulting",
            "/Creator": "fourat.dev résumé generator",
        }
    )
    with destination.open("wb") as output:
        writer.write(output)


def generate(language: str, source: Path, filename: str, metadata: dict[str, str]) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    temporary = OUTPUT_DIR / f".{filename}.untagged.pdf"
    destination = OUTPUT_DIR / filename
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="ResumeTitle",
            parent=styles["Title"],
            fontName="Helvetica-Bold",
            fontSize=23,
            leading=26,
            textColor=colors.HexColor("#164f7a"),
            alignment=TA_CENTER,
            spaceAfter=4 * mm,
        )
    )
    styles.add(
        ParagraphStyle(
            name="ResumeH2",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=13,
            leading=15,
            textColor=colors.HexColor("#164f7a"),
            borderColor=colors.HexColor("#9ca3af"),
            borderWidth=0,
            borderPadding=(0, 0, 2, 0),
            spaceBefore=4.5 * mm,
            spaceAfter=2 * mm,
            keepWithNext=True,
        )
    )
    styles.add(
        ParagraphStyle(
            name="ResumeH3",
            parent=styles["Heading3"],
            fontName="Helvetica-Bold",
            fontSize=10.2,
            leading=12.2,
            textColor=colors.HexColor("#202124"),
            spaceBefore=2.5 * mm,
            spaceAfter=0.8 * mm,
            keepWithNext=True,
        )
    )
    styles.add(
        ParagraphStyle(
            name="ResumeBody",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=8.6,
            leading=10.7,
            textColor=colors.HexColor("#202124"),
            spaceAfter=0.9 * mm,
        )
    )
    styles.add(
        ParagraphStyle(
            name="ResumeContact",
            parent=styles["ResumeBody"],
            alignment=TA_CENTER,
            textColor=colors.HexColor("#374151"),
            spaceAfter=4 * mm,
        )
    )

    story = [
        TaggedParagraph(metadata["heading"], styles["ResumeTitle"], "H1"),
        TaggedParagraph(
            '<link href="mailto:mastouri.fourat@gmail.com">mastouri.fourat@gmail.com</link> · '
            '<link href="https://fourat.dev/">fourat.dev</link> · '
            '<link href="https://pro.fourat.dev/">LinkedIn</link>',
            styles["ResumeContact"],
            "P",
        ),
    ]
    role_styles = {"H2": styles["ResumeH2"], "H3": styles["ResumeH3"], "P": styles["ResumeBody"]}
    for role, text in markdown_blocks(source):
        story.append(TaggedParagraph(text, role_styles[role], role))
    story.append(Spacer(1, 2 * mm))

    canvas_holder: dict[str, TaggedCanvas] = {}

    def canvas_factory(*args, **kwargs):
        tagged_canvas = TaggedCanvas(*args, language=language, **kwargs)
        tagged_canvas.setTitle(metadata["title"])
        tagged_canvas.setSubject(metadata["subject"])
        canvas_holder["canvas"] = tagged_canvas
        return tagged_canvas

    document = SimpleDocTemplate(
        str(temporary),
        pagesize=A4,
        rightMargin=13 * mm,
        leftMargin=13 * mm,
        topMargin=12 * mm,
        bottomMargin=12 * mm,
        title=metadata["title"],
        author="Fourat Mastouri",
    )
    document.build(story, canvasmaker=canvas_factory)
    tag_pdf(temporary, destination, canvas_holder["canvas"].tags_by_page, language, metadata)
    temporary.unlink()
    shutil.copy2(destination, STATIC_DIR / filename)
    print(f"Generated {destination.relative_to(ROOT)}")


def main() -> None:
    generate(
        "en-US",
        ROOT / "content" / "en" / "cv.md",
        "resume_en.pdf",
        {
            "heading": "Fourat Mastouri — Senior Data Engineer",
            "title": "Fourat Mastouri — Senior Data Engineer Résumé",
            "subject": "Professional résumé and selected data-engineering experience",
        },
    )
    generate(
        "fr-FR",
        ROOT / "content" / "fr" / "cv.md",
        "resume_fr.pdf",
        {
            "heading": "Fourat Mastouri — Senior Data Engineer",
            "title": "Fourat Mastouri — CV Senior Data Engineer",
            "subject": "CV professionnel et expériences sélectionnées en data engineering",
        },
    )


if __name__ == "__main__":
    main()
