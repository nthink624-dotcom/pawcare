# CR-QUALITY-V1 케어리포트 사실 보존 1차

- 상태: 검수필요
- UI_GATE: Y
- 구현 단계: CR1-IMPLEMENT
- 외부 실행: AI, DB, Auth, 발송, 커밋, 배포 모두 0

## 확정 구현 계약

첫 생성은 같은 설정의 provider/model로 두 단계를 실행한다. 1단계는 AI 경계에서 PII를 제외하고 보수적으로 정리한 원문만 받아 strict atomic facts를 만든다. 2단계는 서버 검증을 통과한 facts와 검증된 예약 사실만 받아 고객 문장을 만들고 모든 문장에 `sourceFactIds`를 연결한다. 두 호출의 token usage와 예상 비용은 합산한다. 자동 재시도는 없다.

원문이 같고 `care-report-v3` generation의 `extractionInputHash`가 일치하면 재작성에서 추출 호출을 생략한다. 이때만 기존 facts, currentDraft, 선택 revisionReason을 문장 작성 단계에 전달한다. 원문이 달라지면 facts를 다시 추출한다. currentDraft와 revisionReason은 추출 prompt에 들어가지 않는다.

서버는 숫자/단위, 좌우, 부위, 부정, certainty, caution, citation을 검사하고 진단·원인·치료·근거 없는 안심을 차단한다. AI 문장이 실패하면 검증된 atomic facts 기반 결정론적 문장으로 대체한다. 저장과 발행도 같은 검사를 통과해야 하며, 수동 편집 citation은 다시 연결해 저장한다.

## 모바일 `D:\petmanager-app` 연동 계약

대상 후보 파일은 모바일 케어리포트 composer/API client/types이다. 정확한 파일명은 모바일 저장소 담당이 확인한다.

`POST /api/owner/care-reports` 요청:

```ts
{
  shopId, appointmentId,
  observations: {
    ...기존 관찰 필드,
    sourceFacts, sourceFactCitations,
    sourceVersion: "care-report-v3",
    generation // 아래 응답 generation 그대로
  },
  voiceTranscript, // 화면의 원문 그대로
  currentDraft?,   // 원문 hash가 같은 재작성에서만
  revisionReason?, // 선택, 최대 500자
  photoConsent,
  currentWeightKg?, clientGenerationId?
}
```

응답은 기존 `careReport`, `sourceFactCitations`, usage/cost에 `sourceFacts`, `extractionReused`, `providerRequestCount`, v3 `generation`을 더한다. v3 generation에는 `schemaVersion`, `promptVersion`, `extractionPromptVersion`, `draftPromptVersion`, `model`, `generationId`, `inputHash`, `extractionInputHash`가 있다.

`PATCH save_draft`와 `PATCH publish` 모두 `careReport`, `careReportObservations`, `careReportSourceText`, `photoConsent`, `action`을 보낸다. save_draft는 기존 `saveRequestId`도 유지한다. UI 원문은 바꾸지 않으며, 원문 변경 뒤에는 이전 초안을 보여 주되 재작성 전 발행을 잠근다. demo/dev preview는 중앙 `inert`와 각 handler early-return을 함께 적용하며 API/AI/DB/Auth/발송과 성공 시뮬레이션을 모두 금지한다.

### 모바일 현재 소스 확인 (읽기 전용)

- 실제 composer/API/type 소유 파일은 `D:\petmanager-app\src\components\owner\owner-ai-care-report-sheet.tsx`다. 이 파일 안에 `CareReport`, `createObservations`, POST 생성, PATCH 임시저장·발행이 함께 있다.
- 로컬 작성 복구까지 v3 metadata를 보존해야 할 경우의 보조 후보는 `D:\petmanager-app\src\lib\care-report\owner-care-report-local-draft.ts`다. 이번 PC 단계에서는 두 파일 모두 수정하지 않았다.
- 현재 모바일 POST는 원문과 수정 요청을 한 문자열로 합쳐 `voiceTranscript`로 보내고, 응답 타입도 `careReport`만 받는다. `sourceFacts`, citations, v3 `generation`, `extractionReused`, `providerRequestCount` 보존이 아직 없다.
- 현재 모바일 PATCH는 `careReport`, `photoConsent`, `action`만 보내므로 `careReportObservations`, `careReportSourceText`, save_draft의 `saveRequestId`를 위 확정 계약에 맞추는 별도 모바일 구현이 필요하다.

## CR1-IMPLEMENT 재작업 검증

- `node --test tests/server/care-report-ai.test.mjs tests/server/care-report-completion-flow-contract.test.mjs tests/server/care-report-provider-validation-runner.test.mjs`: 25/25 PASS. Node의 module type 경고만 있었고 실패는 없다.
- `npm.cmd run typecheck`: PASS.
- 변경 범위 10개 TypeScript/TSX/MJS 파일 scoped ESLint: PASS.
- `git diff --check`: PASS. 기존 LF→CRLF 안내만 있으며 whitespace 오류는 없다.
- 실제 AI/provider, DB, Auth, 발송, 서버, 브라우저 실행은 0이다.

## 다음 검수

독립 기능 검수 후 실제 화면을 1440, 1024, 430, 390에서 확인한다. 원문→초안→국소 확인→행동 순서, 16/24 글자, 44px 조작부, overflow, 키보드 포커스, 세 오류 live region, preview 0-call을 확인해야 한다.
