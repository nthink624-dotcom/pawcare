# 공용 데이터·DB 상세 규칙

이 파일은 DB/API payload, Supabase, migration, RLS, Auth, 개인정보, Storage와 미디어 자산을 다룰 때만 읽는다. 공통 안전·승인 규칙은 이 파일을 읽지 않아도 항상 적용된다.

## 환경과 스키마

- 활성 hosted Supabase는 검수용 연습 DB `petmanager-dev` (`qefxdtmdtvnzgupmjlom`)와 고객용 운영 DB `petmanager` (`ysxykikqnneuhypybjry`) 두 개다.
- PC와 모바일의 로컬 `.env.local`은 기본적으로 검수용 연습 DB를 가리키고, 실제 서비스 런타임만 고객용 운영 DB를 사용한다.
- Supabase CLI link는 변경 가능한 연결 상태일 뿐 환경 정본이 아니다. 원격 명령 전 의도한 환경, linked project ref, 명령 대상을 함께 확인한다.
- `supabase/migrations`가 스키마 정본이다. 긴급 상황 외 수동 dashboard SQL을 피하고, 불가피한 SQL은 즉시 migration으로 backfill한다.
- 원격 DB 쓰기 전 프로젝트, 테이블, 매장, 날짜와 변경 범위를 밝히고 공통 승인 경계를 확인한다.

## 계약·RLS·개인정보

- 공유 계약은 `D:\petmanager\docs\shared\data-contracts.md`를 따른다. DB 컬럼·API payload·상태 의미를 바꾸면 영향받는 PC/backend와 모바일 소비자를 함께 확인하고 계약 문서를 같은 작업에서 갱신한다.
- 클라이언트는 임의 컬럼명, 공유 데이터의 로컬 전용 persistence, PC/backend 계약을 우회하는 직접 Supabase write를 만들지 않는다.
- 개인정보·인증·운영 테이블과 Storage는 RLS를 fail-closed로 유지하고 anon/authenticated/service 역할 권한을 최소화한다.
- 개인정보의 수집 목적, 보관 기간, 삭제·철회, 공유, 외부 processor와 암호화가 소스·정책·실행 환경에서 확인되지 않았다면 구현 완료나 안전 준수로 단정하지 않는다.

## 미디어 자산 보존

- 매장·스태프·반려동물·케어 사진은 durable `media_asset_id` 컬렉션에 추가한다. 기존 ID나 해석되지 않은 legacy URL은 사용자의 명시적 삭제 동작 없이 제거하지 않는다.
- 부분 업로드, signed URL 일부 실패, 재시도, 새로고침, 다중 파일 업로드가 기존 저장 목록을 최신 응답 일부로 교체하면 안 된다.
- signed URL은 batch로 해석하고 유효한 URL을 재사용한다. 사진마다 한 번씩 요청하는 N+1 경로를 만들지 않는다.

