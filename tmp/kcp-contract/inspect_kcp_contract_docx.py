from pathlib import Path
import sys
from zipfile import ZipFile

from lxml import etree


SOURCE = Path(r"D:\OneDrive\Desktop\[KCP 휴대폰본인확인] 거래처등록안내문,개인정보수집이용동의서.docx")

sys.stdout.reconfigure(encoding="utf-8")


def emit(text: str) -> None:
    print(text.encode("utf-8", "backslashreplace").decode("utf-8"))


def main() -> None:
    with ZipFile(SOURCE) as archive:
        print("PACKAGE")
        for name in archive.namelist():
            print(name)

    with ZipFile(SOURCE) as archive:
        print("\nROOT RELATIONSHIPS")
        print(archive.read("_rels/.rels").decode("utf-8", "replace"))
        document_xml = etree.fromstring(archive.read("word/document.xml"))
        print("DOCUMENT ROOT", document_xml.tag)

    print("\nPARAGRAPHS")
    paragraphs = document_xml.xpath(".//*[local-name()='p']")
    for index, item in enumerate(paragraphs):
        text = "".join(item.xpath(".//*[local-name()='t']/text()"))
        if text.strip():
            print(f"P{index}: {text!r}")

    print("\nTABLES")
    for table_index, table in enumerate(document_xml.xpath(".//*[local-name()='tbl']")):
        rows = table.xpath("./*[local-name()='tr']")
        print(f"TABLE {table_index}: {len(rows)} rows")
        for row_index, row in enumerate(rows):
            cells = []
            for cell in row.xpath("./*[local-name()='tc']"):
                cells.append(" | ".join("".join(p.xpath(".//*[local-name()='t']/text()")) for p in cell.xpath(".//*[local-name()='p']")))
            print(f"R{row_index}: {cells!r}")


if __name__ == "__main__":
    main()
