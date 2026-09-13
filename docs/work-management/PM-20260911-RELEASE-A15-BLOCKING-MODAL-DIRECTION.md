# A15 setup blocking modal direction

- Keep the existing operations shell and current screen rendered behind the gate. Remove the old resume banner and empty-body treatment.
- While canonical initial setup readiness is incomplete, wrap all background UI with `inert`, `aria-hidden=true`, and disabled pointer access.
- Show one centered non-dismissible dialog with label `중요`, title `매장 준비를 먼저 완료해 주세요`, primary action `초기 설정 이어하기`, and small support links `함께 고쳐요` and `도움 문의`.
- Do not render an X, long description, checklist, cancel action, or the old `매장 준비 이어가기` copy.
- Initial focus goes to the primary action. Tab and Shift+Tab stay within the three actions. Escape, backdrop click, browser back, and direct `?screen=` changes cannot dismiss or unlock operations.
- The primary action opens the existing setup guide. Leaving the guide returns to the blocking dialog. Canonical readiness completion immediately removes the dialog, dim, inert, and aria-hidden state.
- Use existing neutral dim, white surface, warning role color, radius 18, max width about 440px, desktop padding 24px, mobile padding 20px, and a primary action at least 48px high. At 430/390 keep 16px side clearance and no horizontal overflow.
- Preserve server and public booking hard gates, the top support menu, staff names/photos/order/hours, each saved pale staff header background, and the existing bottom color line.
- Actual QA must pass at 1440, 1024, 430, and 390 with zero clipping/overflow, zero Tab escape, zero Escape/backdrop/back/direct-screen bypass, no duplicate banner/copy, and completed-readiness normal operation restored.
