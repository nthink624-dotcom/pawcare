# KCP identity-service self-check form fill contract

## Reference

- Reference DOCX: `C:\Users\happy\Downloads\[KCP 휴대폰본인확인] 자체점검 체크리스트 및 동의서\[KCP 휴대폰본인확인] 자체점검 체크리스트 및 동의서.docx`
- SHA-256: `568610f8f336ca182eb24d99049eb65960d63d83d45c0125724e5cda3d41f7f3`
- Output purpose: prepare the page-two KCP self-check form for review and signature while preserving all KCP guidance pages and artwork.

## Page and layout evidence

- The source includes a KCP guidance section, a self-check form, and reference/mitigation-guide content.
- The self-check form appears in table 1 through table 3 of `word/document.xml`.
- All source styles, images, headers, footers, page settings, table geometry, and relationships are preserve-only.

## Editable slot map

| Source location | Meaning | Fill state |
| --- | --- | --- |
| Table 1, row 0, value cell | Business name | `넘친Day` |
| Table 1, row 1, value cells | Contact name / email | `정우진` / `nthink624@gmail.com` |
| Table 1, row 2, value cell | Prepared date | `2026. 7. 15.` |
| Table 2, rows 2-8, Y cells | Security review results | Mark `✓` in Y after source-code and deployment-architecture review |
| Table 3, value cell | Responsible person name | `정우진` |

## Intentionally blank slots

- Contact mobile number: no verified mobile number was provided.
- Responsible-person signature/seal: must be completed by the named representative or responsible officer.

## Security basis for Y marks

- CI/DI values are not returned to the browser in the verification response; the client receives only the limited verified identity fields and a short-lived verification token.
- The server fetches and confirms the PortOne verification result with the server-side API secret before issuing a usable verification token.
- The server compares the provider result with the requested name, birth date, and phone number.
- Verification tokens are time-limited and atomically consumed to prevent reuse.
- PortOne credentials are server-side environment values; source does not expose the API secret to browser code.
- Owner/auth API routes use server-side session and verification checks.
- Production web hosting is configured for Vercel HTTPS delivery and the PortOne verification API is called over HTTPS.

## Preservation and verification gates

- The original must remain unchanged.
- Only `word/document.xml` text nodes in mapped cells may change.
- The final package inventory must exactly match the reference package inventory.
- Render every final page with the document renderer and inspect the self-check page at 100% zoom before delivery.
