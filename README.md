# PawCare MVP

모바일 퍼스트 반려동물 미용샵 SaaS MVP입니다. `pawcare-v3.jsx`와 `pawcare-landing.jsx`의 흐름을 실제 Next.js + Supabase 구조로 옮겼고, Supabase 키가 없으면 데모 모드로도 바로 실행됩니다.

## 포함 범위
- 오너 앱: 홈, 예약, 고객, 재방문, 설정 탭
- 고객 예약 페이지: `/book/[shopId]`
- 랜딩 페이지 + 관심 등록 + 피드백 수집
- Supabase 스키마/마이그레이션/시드
- Solapi 알림 어댑터용 추상화와 mock fallback
- Supabase 환경이 있을 때 오너 전화 OTP 로그인 게이트

## 시작 방법
1. `cp .env.example .env.local`에 해당하는 값을 채웁니다.
2. `npm install`
3. `npm run dev`
4. 브라우저에서 `http://localhost:3000`
5. 오너 앱은 `http://localhost:3000/owner`
6. 고객 예약 페이지는 `http://localhost:3000/book/demo-shop`

## 데모 모드
- Supabase 키가 비어 있으면 메모리 기반 데모 데이터로 동작합니다.
- 페이지 새로고침 또는 서버 재시작 시 데모 데이터는 초기화될 수 있습니다.

## Supabase 설정
1. Supabase 프로젝트 생성
2. Phone Auth 활성화
3. `supabase/migrations/202603160001_init.sql` 실행
4. `supabase/seed/seed.sql` 실행
5. `.env.local`에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` 입력
6. Vercel에도 같은 환경변수 등록

## Solapi 준비
- 현재는 키가 없으면 자동으로 mock 알림 로그를 남깁니다.
- Phase 2에서 실제 템플릿 전송 API를 붙일 수 있도록 알림 타입과 로그 테이블을 분리해 두었습니다.

## 스크립트
- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`
- `npm run typecheck`

## 배포
1. Git 저장소를 Vercel에 연결
2. 환경변수 등록
3. 배포 후 `/owner`, `/book/demo-shop` 동작 확인
4. Supabase Auth SMS 공급자와 허용 도메인 설정 확인

## 남은 수동 작업 체크리스트
- Supabase 프로젝트 생성 및 SQL 실행
- Phone OTP SMS 공급자 설정
- Vercel 환경변수 등록
- Solapi 실사용 키 입력 시 실제 발송 어댑터 확장
