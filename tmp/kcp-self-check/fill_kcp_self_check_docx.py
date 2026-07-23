from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile
import hashlib
import shutil
import tempfile

from lxml import etree


SOURCE = Path(r"C:\Users\happy\Downloads\[KCP 휴대폰본인확인] 자체점검 체크리스트 및 동의서\[KCP 휴대폰본인확인] 자체점검 체크리스트 및 동의서.docx")
OUTPUT = Path(r"D:\petmanager\output\docx\KCP_휴대폰본인확인_자체점검_작성본.docx")
EXPECTED_SOURCE_HASH = "568610f8f336ca182eb24d99049eb65960d63d83d45c0125724e5cda3d41f7f3"


def direct_children(element, local_name: str):
    return [child for child in element if etree.QName(child).localname == local_name]


def paragraph_text(paragraph) -> str:
    return "".join(paragraph.xpath(".//*[local-name()='t']/text()"))


def set_cell_text(cell, value: str) -> None:
    paragraphs = cell.xpath(".//*[local-name()='p']")
    if not paragraphs:
        raise RuntimeError("Expected a paragraph in the mapped cell.")

    target_paragraph = paragraphs[0]
    text_nodes = target_paragraph.xpath(".//*[local-name()='t']")
    if not text_nodes:
        namespace = etree.QName(target_paragraph).namespace
        run = etree.SubElement(target_paragraph, f"{{{namespace}}}r")
        text_node = etree.SubElement(run, f"{{{namespace}}}t")
        text_node.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
        text_nodes = [text_node]

    text_nodes[0].text = value
    for text_node in text_nodes[1:]:
        text_node.text = ""
    for paragraph in paragraphs[1:]:
        for text_node in paragraph.xpath(".//*[local-name()='t']"):
            text_node.text = ""


def mapped_cell(tables, table_index: int, row_index: int, cell_index: int):
    rows = direct_children(tables[table_index], "tr")
    cells = direct_children(rows[row_index], "tc")
    return cells[cell_index]


def verify_output() -> None:
    with ZipFile(SOURCE) as source_zip, ZipFile(OUTPUT) as output_zip:
        source_names = source_zip.namelist()
        if source_names != output_zip.namelist():
            raise RuntimeError("The output package inventory differs from the reference package.")

        changed_parts = [name for name in source_names if source_zip.read(name) != output_zip.read(name)]
        if changed_parts != ["word/document.xml"]:
            raise RuntimeError(f"Unexpected changed package parts: {changed_parts}")

        document_xml = etree.fromstring(output_zip.read("word/document.xml"))
        tables = document_xml.xpath(".//*[local-name()='tbl']")
        expected = {
            (1, 0, 1): "넘친Day",
            (1, 1, 1): "정우진",
            (1, 1, 5): "nthink624@gmail.com",
            (1, 2, 1): "2026. 7. 15.",
            (3, 0, 1): "정우진",
        }
        for coordinates, value in expected.items():
            found = paragraph_text(mapped_cell(tables, *coordinates))
            if found != value:
                raise RuntimeError(f"Unexpected value at {coordinates}: {found!r}")

        for row_index in range(2, 9):
            found = paragraph_text(mapped_cell(tables, 2, row_index, 2))
            if found != "✓":
                raise RuntimeError(f"The Y mark for checklist row {row_index - 1} is missing.")


def main() -> None:
    source_hash = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    if source_hash != EXPECTED_SOURCE_HASH:
        raise RuntimeError("The reference DOCX changed after inspection. Reinspect before filling it.")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(SOURCE) as source_zip:
        document_xml = etree.fromstring(source_zip.read("word/document.xml"))
        tables = document_xml.xpath(".//*[local-name()='tbl']")
        replacements = {
            (1, 0, 1): "넘친Day",
            (1, 1, 1): "정우진",
            (1, 1, 5): "nthink624@gmail.com",
            (1, 2, 1): "2026. 7. 15.",
            (3, 0, 1): "정우진",
        }
        for coordinates, value in replacements.items():
            set_cell_text(mapped_cell(tables, *coordinates), value)

        for row_index in range(2, 9):
            set_cell_text(mapped_cell(tables, 2, row_index, 2), "✓")

        updated_document_xml = etree.tostring(document_xml, encoding="UTF-8", xml_declaration=True, standalone=True)

        with tempfile.NamedTemporaryFile(delete=False, suffix=".docx") as temp_file:
            temp_path = Path(temp_file.name)
        try:
            with ZipFile(temp_path, "w", ZIP_DEFLATED) as output_zip:
                for item in source_zip.infolist():
                    payload = updated_document_xml if item.filename == "word/document.xml" else source_zip.read(item.filename)
                    output_zip.writestr(item, payload)
            shutil.move(str(temp_path), OUTPUT)
        finally:
            temp_path.unlink(missing_ok=True)

    verify_output()
    print(OUTPUT)


if __name__ == "__main__":
    main()
