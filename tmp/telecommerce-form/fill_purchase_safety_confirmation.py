from io import BytesIO
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph


SOURCE = Path(r"C:\Users\happy\Downloads\9199a39712b24ecfb2f0b6fdf9e5e9e6.pdf")
OUTPUT = Path(r"D:\petmanager\output\pdf\purchase-safety-exemption-confirmation-nunchin-day.pdf")
FONT_PATH = Path(r"C:\Windows\Fonts\malgun.ttf")
FONT_BOLD_PATH = Path(r"C:\Windows\Fonts\malgunbd.ttf")


def draw_paragraph(pdf: canvas.Canvas, text: str, x: float, y: float, width: float) -> None:
    style = ParagraphStyle(
        "Reason",
        fontName="Malgun",
        fontSize=8.2,
        leading=11.5,
        alignment=TA_LEFT,
        textColor="black",
    )
    paragraph = Paragraph(text, style)
    _, height = paragraph.wrap(width, 100)
    paragraph.drawOn(pdf, x, y - height)


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdfmetrics.registerFont(TTFont("Malgun", str(FONT_PATH)))
    pdfmetrics.registerFont(TTFont("MalgunBold", str(FONT_BOLD_PATH)))

    reader = PdfReader(str(SOURCE))
    if len(reader.pages) != 1:
        raise RuntimeError("Expected a one-page confirmation form.")

    page = reader.pages[0]
    page_width = float(page.mediabox.width)
    page_height = float(page.mediabox.height)
    overlay_buffer = BytesIO()
    overlay = canvas.Canvas(overlay_buffer, pagesize=(page_width, page_height))

    # Article 24(3) items 3 and 4: digital SaaS supplied over a monthly term.
    overlay.setFont("Helvetica-Bold", 9)
    overlay.drawString(79, 570, "X")
    overlay.drawString(79, 522, "X")

    overlay.setFont("Malgun", 13)
    overlay.drawString(142, 305, "\uc815\uc6b0\uc9c4")
    overlay.setFont("Malgun", 12)
    overlay.drawString(201, 219, "2026")
    overlay.drawString(279, 219, "7")
    overlay.drawString(326, 219, "16")

    # Keep the response within the form's limited free-text area.
    overlay.setFillColorRGB(1, 1, 1)
    overlay.rect(75, 326, 446, 68, stroke=0, fill=1)
    overlay.setFillColorRGB(0, 0, 0)
    reason = (
        "\uc2e0\uace0\uc778\uc740 \ubc18\ub824\ub3d9\ubb3c \ubbf8\uc6a9\uc0f5 \uc6b4\uc601\uc790\ub97c \uc704\ud55c \ud074\ub77c\uc6b0\ub4dc \uae30\ubc18 SaaS '\ud3ab\ub9e4\ub2c8\uc800'\ub97c \uc6d4 \ub2e8\uc704 \uad6c\ub3c5 \ubc29\uc2dd\uc73c\ub85c \uc81c\uacf5\ud569\ub2c8\ub2e4. "
        "\ubcf8 \uc11c\ube44\uc2a4\ub294 \ubb3c\ud488 \ubc30\uc1a1 \uac70\ub798\uac00 \uc544\ub2c8\ub77c \uc778\ud130\ub137\uc744 \ud1b5\ud574 \uc608\uc57d\u00b7\uace0\uac1d\u00b7\uc9c1\uc6d0\u00b7\uc77c\uc815 \uad00\ub9ac \uae30\ub2a5\uc744 \uc81c\uacf5\ud558\ub294 \uc6a9\uc5ed\uc785\ub2c8\ub2e4. "
        "\uc774\uc6a9\uc790\uac00 \uacb0\uc81c \ud6c4 \ud574\ub2f9 \uc774\uc6a9\uae30\uac04 \ub3d9\uc548 \uc11c\ube44\uc2a4\ub97c \uc9c0\uc18d\uc801\uc73c\ub85c \uc774\uc6a9\ud558\ubbc0\ub85c, \uc815\ubcf4\ud1b5\uc2e0\ub9dd\uc73c\ub85c \uc81c\uacf5\ub418\uc5b4 \ubc30\uc1a1 \ud655\uc778\uc774 \ubd88\uac00\ub2a5\ud55c \uac70\ub798\uc774\uc790 \uc77c\uc815 \uae30\uac04\uc5d0 \uac78\uccd0 \ubd84\ud560 \uacf5\uae09\ub418\ub294 \uac70\ub798\uc5d0 \ud574\ub2f9\ud569\ub2c8\ub2e4(\uc81c3\ud638 \ubc0f \uc81c4\ud638)."
    )
    draw_paragraph(overlay, reason, 76, 394, 445)

    overlay.save()
    overlay_buffer.seek(0)
    page.merge_page(PdfReader(overlay_buffer).pages[0])

    writer = PdfWriter()
    writer.add_page(page)
    with OUTPUT.open("wb") as target:
        writer.write(target)


if __name__ == "__main__":
    main()
