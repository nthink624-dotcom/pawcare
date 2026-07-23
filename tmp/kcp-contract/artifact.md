# KCP trade-partner registration form fill contract

## Reference

- Reference DOCX: `D:\OneDrive\Desktop\[KCP 휴대폰본인확인] 거래처등록안내문,개인정보수집이용동의서.docx`
- SHA-256: `3ff3f507ff8df70b5c5437e1a269ac075e182f619515bc055a8af91b2ef1e43f`
- Source package: strict OOXML namespace with no standard `w:sectPr`; it cannot be rendered by the packaged renderer and is not accepted by `python-docx` because the package uses strict relationship URIs.
- Intended output: a byte-preserving package copy with only text in the explicitly mapped form cells replaced.

## Page and layout evidence

- The source is a two-part KCP form: `거래처 등록 안내문 (사업자용)` followed by `개인정보 수집 · 이용 동의서 (사업자용)`.
- All styles, table geometry, fonts, headers, footers, relationships, and package parts are preserve-only.
- No visual restyling, page geometry alteration, or section insertion is permitted.

## Editable slot map

| Source location | Meaning | Fill state |
| --- | --- | --- |
| Table 1, row 0, value cell | Business form | `개인` |
| Table 1, row 1, value cell | Business name | `넘친Day` |
| Table 1, row 2, value cells | Business registration number / representative | `462-16-02885` / `정우진` |
| Table 1, row 3, value cell | Registered business address | `충청남도 천안시 동남구 미라9길 14 지하 1층` |
| Table 1, row 4, first value cell | Business phone | `041-557-5529` |
| Table 2, row 0, value cell | Tax/accounting contact name | `정우진` |
| Table 2, row 2, value cell | Tax/accounting contact email | `nthink624@gmail.com` |
| Table 5, row 0, value cell | Business registration number | `462-16-02885` |
| Table 5, row 1, value cell | Business name | `넘친Day` |

## Intentionally blank slots

- Business type/category (must match the business registration certificate).
- Contact mobile number (not available in verified source data).
- Consent selection, signature/seal, and signing date (require the named personal information subject's own action).

## Preservation and verification gates

- The reference file must stay byte-for-byte unchanged.
- Only `word/document.xml` text nodes in mapped form cells may change in the final package.
- The final package inventory must match the reference inventory.
- Rendering is unavailable because this legacy strict-OOXML form has no section properties and LibreOffice is unavailable in the workspace. Structural package verification replaces image QA for this form.
