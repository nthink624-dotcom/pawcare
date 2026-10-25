import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const ui = readFileSync(new URL("../../src/components/admin/application-flow-demo.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../../src/app/admin/marketing/application-flow-demo/page.tsx", import.meta.url), "utf8");
const workroom = readFileSync(new URL("../../src/components/admin/demo-agent-control-plane.tsx", import.meta.url), "utf8");

test("application demo is development-only and fail-closed", () => { assert.match(page, /NODE_ENV !== "development"/); assert.match(ui, /formPublishable: false/); assert.match(ui, /formSubmissionEnabled: false/); assert.match(ui, /analyticsEnabled: false/); assert.match(ui, /externalCallsEnabled: false/); });
test("shows only the approved five application fields", () => { for (const field of ["매장명", "신청자 역할", "운영 형태", "예약 접수 방식", "불편한 장면"]) assert.match(ui, new RegExp(field)); assert.doesNotMatch(ui, /전화번호|이메일|보호자|반려동물|textarea|type="email"|type="tel"/); });
test("has three independent optional consents and five fixtures", () => { assert.match(ui, /useState\(\[false, false, false\]\)/); for (const state of ["필수 누락", "정책 대기", "Preview 잠금", "성공 fixture", "실패 fixture"]) assert.match(ui, new RegExp(state)); });
test("does not contain form, persistence, analytics, or external request paths", () => { assert.doesNotMatch(ui, /<form|action=|fetch\(|localStorage|sessionStorage|document\.cookie|supabase|gtag|analytics\.|XMLHttpRequest|sendBeacon/); });
test("workroom reports use one-line allowlisted senders", () => { assert.match(workroom, /overflow-hidden text-ellipsis whitespace-nowrap/); for (const sender of ["운영팀", "펫매니저 성장팀", "펫매니저 마케팅 분석팀", "Codex 구현팀", "발신팀 확인 불가"]) assert.match(workroom, new RegExp(sender)); assert.doesNotMatch(workroom, /ChatGPT가 보냄/); });
test("canonical local workroom stays on the admin 3000 origin", () => { const adminPage = readFileSync(new URL("../../src/app/admin/marketing/page.tsx", import.meta.url), "utf8"); assert.match(adminPage, /DemoAgentControlPlane mode="operational"/); assert.doesNotMatch(adminPage + workroom + page, /3015|\/dev\/agent-control-plane-preview|\/dev\/application-flow-demo/); });
test("owner request and operations directive remain distinct clickable events", () => { assert.match(workroom, /owner_request_received/); assert.match(workroom, /operations_directive_sent/); assert.match(workroom, /setSelectedEventId\(event\.eventId\)/); assert.match(workroom, /이전 기록 동기화 제한/); assert.match(workroom, /eventAsNode/); });
