# PC 로컬·Vercel·배포 상세 규칙

이 파일은 `D:\petmanager\apps\web`의 로컬 서버, 환경변수, Vercel, 배포, 운영 복구 또는 릴리스 확인을 다룰 때만 읽는다. 실행 승인 경계는 공통 규칙이 우선한다.

## 정본과 표시

- PC 구현 정본은 현재 `D:\petmanager\apps\web` checkout뿐이다. detached worktree, 복사 fixture, 오래된 clean build는 내부 참고용이며 대표의 최신 로컬 제품으로 안내하지 않는다.
- 대표용 PC 로컬 origin은 `http://127.0.0.1:3000`, 정본 화면은 `/owner`와 `/admin`이다. 다른 포트나 `localhost`를 대표용 링크로 쓰지 않는다.
- 서버 시작·링크 공유 전 `npm run check:owner-preview`를 실행하고 저장소, origin, route, stage, 검수용 연습 DB ref 불일치는 hard stop으로 처리한다.
- 환경 보고는 `[PC 로컬]`, `[검수 서버]`, `[운영 서버]` 중 하나로 시작한다. 서버와 DB를 구분해 필요하면 `[PC 로컬 + 검수용 연습 DB]`처럼 적는다.
- `[PC 로컬]`의 `.env.local`은 검수용 연습 DB ref `qefxdtmdtvnzgupmjlom`, Vercel Production은 고객용 운영 DB ref `ysxykikqnneuhypybjry`를 사용한다. 키 값은 출력하지 않는다.

## 동기화·빌드·운영

- env 정본은 `D:\petmanager-shared\env\petmanager.env.local`이고 프로젝트 root `.env.local`은 동기화 사본이다. 실제 비밀을 Git에 넣지 않는다.
- `npm run build`는 compile 전에 reliability regression suite를 실행해야 한다. 배포를 통과시키기 위해 이 gate를 제거하거나 우회하지 않는다.
- 오너 웹은 예상치 못한 client 오류가 blank page가 되지 않도록 route-level error recovery boundary를 유지한다.
- 로컬 소스·집중 테스트·build, Git commit/push, Vercel deploy, Production smoke는 별도 증거다. 하나로 다른 단계를 대체하지 않는다.
- 대표가 3000 서버 유지를 요청하면 그대로 두고, 작업이 시작한 비정본 dev server·자동 browser·임시 profile만 종료 여부를 확인한다.

