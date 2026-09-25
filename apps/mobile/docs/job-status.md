# Job Status Tracking

PawCare 로컬 작업 상태를 JSON으로 남기는 최소 구조입니다.

저장 위치:
- `.pawcare-status/last-job.json`
- `.pawcare-status/jobs/*.json`

추가된 명령어:
- `npm run status:start -- --title "작업 제목"`
- `npm run status:complete -- --job-id "작업ID"`
- `npm run status:fail -- --job-id "작업ID"`
- `npm run status:last`
- `npm run status:list`

권장 사용 순서:
1. 작업 시작

```bash
npm run status:start -- --title "작업 제목" --summary "시작 메모"
```

2. 작업 완료 또는 실패 기록

```bash
npm run status:complete -- --job-id "작업ID" --summary "결과 요약" --file "package.json" --file "scripts/job-status.ts"
```

또는

```bash
npm run status:fail -- --job-id "작업ID" --summary "실패 사유" --note "추가 메모"
```

3. 마지막 상태와 이력 확인

```bash
npm run status:last
npm run status:list -- --limit 10
```

입력 규칙:
- `--job-id`를 생략하면 `status:complete`, `status:fail`은 마지막 작업을 갱신합니다.
- `--note`는 여러 번 넣을 수 있습니다.
- `--file`은 여러 번 넣을 수 있습니다.
- 모든 상태 파일 포맷은 JSON입니다.
