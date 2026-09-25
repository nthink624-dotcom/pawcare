# UI 파일 구조 상세 규칙

이 파일은 PC 또는 모바일 React UI 파일을 분리·리팩터링하거나 큰 UI 파일을 수정할 때만 읽는다.

- React UI 파일은 보통 500줄 아래를 목표로 하고, 500줄 초과는 구조 검토 후보, 800줄 초과는 UI 변경 전 분리 계획 대상이다.
- 줄 수만 보고 기계적으로 나누지 않는다. page shell, toolbar, list, item/card, detail panel, form, modal/bottom sheet, status badge, presentational component처럼 책임이 분명할 때만 분리한다.
- 먼저 표현 컴포넌트를 추출한다. 분리 작업에서 API call, state logic, validation, routing, billing, auth, notification, data model을 바꾸지 않는다.
- 분리나 UI 변경이 동작 계약까지 건드릴 가능성이 있으면 범위를 임의로 넓히지 말고 별도 변경으로 보고한다.
- 프로젝트에 `docs/engineering/file-structure-standard.md`가 있으면 관련 기준을 함께 읽는다.

