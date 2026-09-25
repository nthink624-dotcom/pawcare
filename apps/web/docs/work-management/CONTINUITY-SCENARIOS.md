# 업무 연속성 검증 시나리오

이 문서는 주담당의 `next-ready` 선택이 대표 요청 사이에서 이탈하지 않는지 검증합니다. 각 시나리오는 결과가 하나로 결정되어야 PASS입니다.

| 시나리오 | 주어진 상태 | 예상 선택 | PASS 근거 |
| --- | --- | --- | --- |
| A-1 완료 → A-2 | A-2의 `depends_on=[A-1]`, 같은 lane, B-1도 pending | A-2를 next-ready/active로 선택 | 같은 parent의 열린 단계가 B보다 우선 |
| A-2 차단 → 승인 대기 | A-2가 승인 없이는 진행 불가 | A-2=blocked, owner_approval_required=Y, 재개 조건 기록 후 한 번 요청하고 대기 | 승인 대기는 stalled가 아니며 B로 자동 전환하지 않음 |
| A와 독립 B 병렬 | A-2와 B-1의 lane·파일·승인·실행 자원이 모두 독립 | A-2와 B-1 각각 자기 lane에서 active 가능 | B 병렬 예외 근거가 기록되고 lane당 active=1 유지 |
| QA 실패 → A-2 재작업 | A-2 구현 task completed 뒤 독립 QA FAIL | A-2=rework, 같은 parent/step의 구현자에게 최소 delta 반환 후 재검수 | 상위 A와 A-2를 완료 처리하지 않음 |
| 담당 정체 → 1회 재개 → 교체 | A-2가 interrupted/failed/10분 무출력, 재개 뒤 다시 정체 | 첫 정체는 같은 A-2 재개 1회; 두 번째는 중지·소유권 반환 확인 후 compact handoff로 담당 교체 | 새 담당도 같은 parent/step을 이어가며 원문 로그를 받지 않음 |

## 판정 체크

- 모든 단계에 `parent_work_id`, `step_id`, `lane`, `depends_on`, 단계 완료 조건이 있습니다.
- 같은 lane의 active가 둘 이상인 결과는 FAIL입니다.
- 명시적 우선순위 변경이나 독립 리소스 근거 없이 B가 A의 next-ready보다 먼저 선택되면 FAIL입니다.
- task `completed`만으로 상위 업무가 완료되면 FAIL입니다.
- blocker에 재개 조건 또는 대표 승인 필요 여부가 빠지면 FAIL입니다.
- 두 번째 정체에서 기존 담당의 중지·소유권 반환 확인 없이 새 작성자를 시작하면 FAIL입니다.
