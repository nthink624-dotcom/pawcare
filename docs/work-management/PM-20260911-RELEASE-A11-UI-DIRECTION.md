# A11 initial setup hard gate UI direction

- Incomplete owner shell hides the operational sidebar, search, and screen selector. It keeps only setup steps `operatingHours`, `staff`, `services`; top support items `함께 고쳐요`, `도움 문의`; and profile, email, logout, terms, privacy, and account deletion paths.
- Blocked `?screen=` values normalize before render to the next incomplete setup step. No operational screen may flash.
- The resume banner contains only `매장 준비 이어가기` and exactly one `이어하기` action. The removed sentence must not exist in the DOM. The action is at least 44 by 44 pixels and retains visible keyboard focus.
- `/entry/[shopId]`, `/book/[shopId]`, and `/book/[shopId]/info` show one neutral state with `매장 준비를 먼저 완료해 주세요` and no booking controls when incomplete. Manage may retain existing-booking read access while change, cancel, and rebook writes are disabled.
- Completed shops retain the existing shell and booking flow. Staff headers retain each saved individual pale background and the existing bottom color line; names, photos, order, and work hours stay unchanged.
- Verify PC at 1440 and 1024, public booking at 430 and 390, 200 percent zoom/reflow, keyboard order/focus/Escape, zero document overflow, zero console/page errors, exact support items, exact unavailable copy, and no duplicate CTA or removed sentence.
