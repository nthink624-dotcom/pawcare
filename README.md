# PawCare MVP

PawCare는 모바일 퍼스트 반려동물 미용샵 SaaS MVP입니다. 현재 구조는 Next.js 프론트와 `backend/` Node API 서버가 분리되어 있으며, 프론트는 화면과 폼 중심으로만 동작하고 서버 권한 로직은 백엔드가 담당합니다.

## 실행
1. 루트에서 `npm install`
2. `backend/`에서 `npm install`
3. 루트 `.env.local` 작성
4. `backend/.env` 작성
5. 프론트: `npm run dev:frontend`
6. 백엔드: `npm run dev:backend`

## 환경 변수
- 프론트: [.env.example](/D:/pawcare/.env.example)
- 백엔드: [backend/.env.example](/D:/pawcare/backend/.env.example)

## 참고 문서
- 분리 실행/인증/API 흐름: [docs/frontend-backend-split.md](/D:/pawcare/docs/frontend-backend-split.md)
