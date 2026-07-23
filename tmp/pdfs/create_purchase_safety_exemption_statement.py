from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "output" / "pdf" / "purchase-safety-exemption-statement-nunchin-day.pdf"
FONT_PATH = Path(r"C:\Windows\Fonts\malgun.ttf")
FONT_BOLD_PATH = Path(r"C:\Windows\Fonts\malgunbd.ttf")


def paragraph(text: str, style: ParagraphStyle) -> Paragraph:
    return Paragraph(text.replace("\n", "<br/>"), style)


def build_pdf() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdfmetrics.registerFont(TTFont("Malgun", str(FONT_PATH)))
    pdfmetrics.registerFont(TTFont("MalgunBold", str(FONT_BOLD_PATH)))

    page_width, page_height = A4
    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        leftMargin=24 * mm,
        rightMargin=24 * mm,
        topMargin=20 * mm,
        bottomMargin=18 * mm,
        title="구매안전서비스 적용 제외 소명서",
        author="넘친 Day",
    )

    styles = getSampleStyleSheet()
    title = ParagraphStyle(
        "TitleKorean",
        parent=styles["Title"],
        fontName="MalgunBold",
        fontSize=20,
        leading=28,
        alignment=TA_CENTER,
        textColor=colors.HexColor("#172033"),
        spaceAfter=4 * mm,
    )
    recipient = ParagraphStyle(
        "Recipient",
        parent=styles["Normal"],
        fontName="Malgun",
        fontSize=10,
        leading=15,
        alignment=TA_RIGHT,
        textColor=colors.HexColor("#46556B"),
        spaceAfter=5 * mm,
    )
    body = ParagraphStyle(
        "BodyKorean",
        parent=styles["Normal"],
        fontName="Malgun",
        fontSize=10.3,
        leading=18,
        alignment=TA_JUSTIFY,
        textColor=colors.HexColor("#202B3D"),
    )
    body_emphasis = ParagraphStyle(
        "BodyEmphasis",
        parent=body,
        fontName="MalgunBold",
    )
    section = ParagraphStyle(
        "SectionKorean",
        parent=styles["Heading2"],
        fontName="MalgunBold",
        fontSize=11.5,
        leading=17,
        textColor=colors.HexColor("#172033"),
        spaceBefore=4 * mm,
        spaceAfter=2.5 * mm,
    )
    table_label = ParagraphStyle(
        "TableLabel",
        parent=body,
        fontName="MalgunBold",
        fontSize=9.3,
        leading=14,
        textColor=colors.HexColor("#344258"),
    )
    table_value = ParagraphStyle(
        "TableValue",
        parent=body,
        fontSize=9.3,
        leading=14,
    )
    footnote = ParagraphStyle(
        "Footnote",
        parent=body,
        fontSize=8.3,
        leading=13,
        textColor=colors.HexColor("#66758A"),
    )

    story = [
        paragraph("구매안전서비스 적용 제외 소명서", title),
        paragraph("수신: 통신판매업 신고 담당자 귀중", recipient),
        HRFlowable(width="100%", thickness=1.2, color=colors.HexColor("#1D4F91"), spaceAfter=5 * mm),
    ]

    business_data = [
        [paragraph("상호", table_label), paragraph("넘친 Day", table_value), paragraph("대표자", table_label), paragraph("정우진", table_value)],
        [paragraph("사업자등록번호", table_label), paragraph("462-16-02885", table_value), paragraph("서비스명", table_label), paragraph("펫매니저 (PetManager)", table_value)],
        [paragraph("거래 형태", table_label), paragraph("월 단위 정기 구독형 SaaS 이용권", table_value), paragraph("작성일", table_label), paragraph("2026년 7월 15일", table_value)],
    ]
    business_table = Table(business_data, colWidths=[31 * mm, 54 * mm, 31 * mm, 54 * mm])
    business_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F1F5FA")),
                ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#F1F5FA")),
                ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#B9C7D8")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D5DFEA")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.extend([business_table, Spacer(1, 5 * mm)])

    story.extend(
        [
            paragraph("1. 소명 취지", section),
            paragraph(
                "당사는 반려동물 미용샵 사업자를 위한 클라우드 기반 운영관리 서비스인 펫매니저를 제공하고 있습니다. "
                "본 소명서는 펫매니저의 유료 이용권 거래가 「전자상거래 등에서의 소비자보호에 관한 법률」 "
                "제24조 제3항 제4호의 적용 제외 거래에 해당함을 소명하기 위하여 제출합니다.",
                body,
            ),
            paragraph("2. 서비스 및 공급 방식", section),
            paragraph(
                "펫매니저의 유료 이용권은 물품을 배송하거나 일회성으로 제공하는 거래가 아니라, "
                "이용자가 월 단위 이용기간 동안 예약, 고객, 직원, 일정 등 운영관리 기능을 계속 이용할 수 있도록 제공하는 "
                "정기 구독형 소프트웨어 서비스입니다. 이용대금은 해당 이용기간의 서비스 이용권에 대한 대가이며, "
                "서비스는 약정된 이용기간 동안 지속적으로 제공됩니다.",
                body,
            ),
            paragraph("3. 법률상 적용 제외 근거", section),
            paragraph(
                "「전자상거래 등에서의 소비자보호에 관한 법률」 제24조 제3항 제4호는 "
                "‘일정 기간에 걸쳐 분할되어 공급되는 재화등을 구매하는 거래’에 대하여 결제대금예치 또는 "
                "소비자피해보상보험계약등의 적용을 제외하고 있습니다.",
                body,
            ),
            Spacer(1, 1.5 * mm),
            paragraph(
                "펫매니저의 월 단위 정기 구독형 SaaS 이용권은 이용기간에 걸쳐 기능과 이용권이 계속 제공되는 거래이므로, "
                "위 제24조 제3항 제4호에 해당합니다. 이에 따라 같은 조 제2항의 결제대금예치 또는 "
                "소비자피해보상보험계약등 적용 대상이 아님을 소명합니다.",
                body_emphasis,
            ),
            paragraph("4. 제출 확인", section),
            paragraph(
                "위 내용은 사실과 다름이 없음을 확인하며, 필요한 경우 서비스 이용요금 및 이용기간을 확인할 수 있는 "
                "화면 자료를 추가로 제출하겠습니다.",
                body,
            ),
            Spacer(1, 9 * mm),
            paragraph("2026년 7월 15일", recipient),
            Spacer(1, 3 * mm),
            paragraph("상호: 넘친 Day", ParagraphStyle("Signature1", parent=body, alignment=TA_RIGHT, fontName="MalgunBold")),
            paragraph("대표자: 정우진  (서명 또는 인)", ParagraphStyle("Signature2", parent=body, alignment=TA_RIGHT, fontName="MalgunBold")),
            Spacer(1, 2 * mm),
        ]
    )

    doc.build(story)


if __name__ == "__main__":
    build_pdf()
