from pathlib import Path
import sys
from zipfile import ZipFile

from lxml import etree


SOURCE = Path(r"C:\Users\happy\Downloads\[KCP 휴대폰본인확인] 자체점검 체크리스트 및 동의서\[KCP 휴대폰본인확인] 자체점검 체크리스트 및 동의서.docx")

sys.stdout.reconfigure(encoding="utf-8")


def direct_children(element, local_name: str):
    return [child for child in element if etree.QName(child).localname == local_name]


def paragraph_text(paragraph) -> str:
    return "".join(paragraph.xpath(".//*[local-name()='t']/text()"))


def main() -> None:
    with ZipFile(SOURCE) as archive:
        print("PACKAGE")
        for name in archive.namelist():
            print(name)
        document_xml = etree.fromstring(archive.read("word/document.xml"))
        print("DOCUMENT ROOT", document_xml.tag)

    print("\nPARAGRAPHS")
    for index, item in enumerate(document_xml.xpath(".//*[local-name()='p']")):
        text = paragraph_text(item)
        if text.strip():
            print(f"P{index}: {text!r}")

    print("\nTABLES")
    for table_index, table in enumerate(document_xml.xpath(".//*[local-name()='tbl']")):
        rows = direct_children(table, "tr")
        print(f"TABLE {table_index}: {len(rows)} rows")
        for row_index, row in enumerate(rows):
            cells = []
            for cell in direct_children(row, "tc"):
                cells.append(" | ".join(paragraph_text(p) for p in cell.xpath(".//*[local-name()='p']")))
            print(f"R{row_index}: {cells!r}")


if __name__ == "__main__":
    main()
