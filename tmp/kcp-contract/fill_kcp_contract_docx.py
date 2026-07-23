from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile
import hashlib
import shutil
import tempfile

from lxml import etree


SOURCE = Path(r"D:\OneDrive\Desktop\[KCP 휴대폰본인확인] 거래처등록안내문,개인정보수집이용동의서.docx")
OUTPUT = Path(r"D:\petmanager\output\docx\KCP_휴대폰본인확인_거래처등록_작성본.docx")
EXPECTED_SOURCE_HASH = "3ff3f507ff8df70b5c5437e1a269ac075e182f619515bc055a8af91b2ef1e43f"


def direct_children(element, local_name: str):
    return [child for child in element if etree.QName(child).localname == local_name]


def paragraph_text(paragraph) -> str:
    return "".join(paragraph.xpath(".//*[local-name()='t']/text()"))


def set_cell_text(cell, value: str) -> None:
    paragraphs = cell.xpath(".//*[local-name()='p']")
    if not paragraphs:
        raise RuntimeError("Expected a paragraph in the mapped cell.")

    text_nodes = paragraphs[0].xpath(".//*[local-name()='t']")
    if not text_nodes:
        raise RuntimeError("Expected a text run in the mapped cell.")

    text_nodes[0].text = value
    for text_node in text_nodes[1:]:
        text_node.text = ""

    for paragraph in paragraphs[1:]:
        for text_node in paragraph.xpath(".//*[local-name()='t']"):
            text_node.text = ""


def mapped_cell(tables, table_index: int, row_index: int, cell_index: int):
    table = tables[table_index]
    rows = direct_children(table, "tr")
    row = rows[row_index]
    cells = direct_children(row, "tc")
    return cells[cell_index]


def verify_output() -> None:
    with ZipFile(SOURCE) as source_zip, ZipFile(OUTPUT) as output_zip:
        source_names = source_zip.namelist()
        output_names = output_zip.namelist()
        if source_names != output_names:
            raise RuntimeError("The output package inventory differs from the reference package.")

        changed_parts = [
            name
            for name in source_names
            if source_zip.read(name) != output_zip.read(name)
        ]
        if changed_parts != ["word/document.xml"]:
            raise RuntimeError(f"Unexpected changed package parts: {changed_parts}")

        output_xml = etree.fromstring(output_zip.read("word/document.xml"))
        tables = output_xml.xpath(".//*[local-name()='tbl']")
        expected = {
            (1, 0, 1): "개인",
            (1, 1, 1): "넘친Day",
            (1, 2, 1): "462-16-02885",
            (1, 2, 3): "정우진",
            (1, 3, 1): "충청남도 천안시 동남구 미라9길 14 지하 1층",
            (1, 4, 1): "041-557-5529",
            (2, 0, 1): "정우진",
            (2, 2, 1): "nthink624@gmail.com",
            (5, 0, 1): "462-16-02885",
            (5, 1, 1): "넘친Day",
        }
        for coordinates, value in expected.items():
            found = paragraph_text(mapped_cell(tables, *coordinates))
            if found != value:
                raise RuntimeError(f"Unexpected value at {coordinates}: {found!r}")


def main() -> None:
    source_hash = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    if source_hash != EXPECTED_SOURCE_HASH:
        raise RuntimeError("The reference DOCX changed after inspection. Reinspect before filling it.")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(SOURCE) as source_zip:
        document_xml = etree.fromstring(source_zip.read("word/document.xml"))
        tables = document_xml.xpath(".//*[local-name()='tbl']")
        replacements = {
            (1, 0, 1): "개인",
            (1, 1, 1): "넘친Day",
            (1, 2, 1): "462-16-02885",
            (1, 2, 3): "정우진",
            (1, 3, 1): "충청남도 천안시 동남구 미라9길 14 지하 1층",
            (1, 4, 1): "041-557-5529",
            (2, 0, 1): "정우진",
            (2, 2, 1): "nthink624@gmail.com",
            (5, 0, 1): "462-16-02885",
            (5, 1, 1): "넘친Day",
        }
        for coordinates, value in replacements.items():
            set_cell_text(mapped_cell(tables, *coordinates), value)

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
