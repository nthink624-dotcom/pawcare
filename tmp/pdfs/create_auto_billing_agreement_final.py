from pathlib import Path

from pypdf import PdfReader, PdfWriter
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path(r"D:\petmanager")
SOURCE = ROOT / "tmp" / "pdfs" / "auto-billing-agreement-source.pdf"
OVERLAY = ROOT / "tmp" / "pdfs" / "auto-billing-agreement-final-overlay.pdf"
OUTPUT = ROOT / "output" / "pdf" / "auto-billing-agreement-petmanager-final.pdf"
FONT_PATH = Path(r"C:\Windows\Fonts\malgun.ttf")


pdfmetrics.registerFont(TTFont("Malgun", str(FONT_PATH)))


def white_box(c: canvas.Canvas, x: float, y: float, width: float, height: float) -> None:
    c.setFillColorRGB(1, 1, 1)
    c.rect(x, y, width, height, stroke=0, fill=1)


def write(c: canvas.Canvas, x: float, y: float, value: str, size: float = 10.5) -> None:
    c.setFillColorRGB(0.08, 0.08, 0.08)
    c.setFont("Malgun", size)
    c.drawString(x, y, value)


reader = PdfReader(str(SOURCE))
page_width = float(reader.pages[0].mediabox.width)
page_height = float(reader.pages[0].mediabox.height)

c = canvas.Canvas(str(OVERLAY), pagesize=(page_width, page_height))

# Page 1: rebuild the opening two lines so the legal merchant name fits inline
# with the contract-party definition instead of colliding with the masked source.
white_box(c, 34, 698, 530, 42)
write(c, 36, 720, "넘친 Day(이하 '갑'이라 한다)과 엔에이치엔케이씨피 주식회사(이하 '을'이라 한다)는 신용카드, 체크카드,", 8.2)
write(c, 36, 706, "선불카드(이하 '신용카드 등'이라 한다) 자동결제서비스에 관하여 다음과 같이 부가 합의한다.", 8.2)
c.showPage()

# Page 2: monthly settlement, four times per month. The checkbox and count are
# in the bottom table, so use the field interiors rather than the page margin.
white_box(c, 351, 68, 23, 13)
write(c, 311, 71, "V", 10.5)
write(c, 354, 71, "4", 10.5)
c.showPage()

# Page 3: KCP requested that the fee section remain blank. Clear only the
# interiors of the template's masked value boxes, leaving table borders intact.
white_box(c, 156, 664, 26, 12)
for y in (462, 435, 407, 381):
    white_box(c, 402, y, 21, 13)
c.showPage()

# Page 4: align merchant and contact details inside each table cell. The phone
# number remains intentionally blank until the merchant enters the desired number.
white_box(c, 151, 616, 30, 16)
white_box(c, 401, 616, 30, 16)
white_box(c, 151, 590, 30, 16)
white_box(c, 400, 590, 129, 16)
write(c, 151, 620, "정우진")
write(c, 401, 620, "대표")
write(c, 405, 594, "nthink624@gmail.com")

# Customer company information.
white_box(c, 178, 283, 160, 17)
white_box(c, 178, 255, 160, 17)
white_box(c, 178, 227, 320, 17)
white_box(c, 178, 199, 160, 17)
white_box(c, 178, 298, 30, 10)
white_box(c, 178, 269, 30, 10)
white_box(c, 178, 240, 30, 10)
white_box(c, 178, 211, 30, 10)
write(c, 180, 289, "넘친 Day")
write(c, 180, 261, "462-16-02885")
write(c, 180, 233, "충청남도 천안시 동남구 미라9길 14 지하 1층")
write(c, 180, 205, "정우진")

# The source prints a split date field; replace the visual masks with a single
# readable date while leaving the signature/seal area untouched.
white_box(c, 214, 42, 190, 20)
write(c, 230, 48, "2026년 07월 21일", 10.5)
c.showPage()
c.save()

overlay_reader = PdfReader(str(OVERLAY))
writer = PdfWriter()
for base_page, overlay_page in zip(reader.pages, overlay_reader.pages):
    base_page.merge_page(overlay_page)
    writer.add_page(base_page)

with OUTPUT.open("wb") as output_file:
    writer.write(output_file)

print(OUTPUT)
