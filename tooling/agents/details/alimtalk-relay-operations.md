# 백엔드 릴레이 운영 절차

이 파일은 공유 알림톡 백엔드의 relay URL, 서버 상태, 환경변수, Vercel 동기화, 재배포와 장애 진단을 다룰 때만 읽는다. 이것은 PC 또는 모바일의 별도 알림톡 정책이 아니며, 발송 의미와 대상은 `alimtalk.md`의 공통 계약을 따른다.

## 참조 경계

- `D:\petmanager`가 공유 백엔드와 relay 구현의 작업 경로다. 모바일 UI·문구·상태 표시 작업은 이 운영 절차를 자동으로 읽거나 모바일 저장소에서 실행하지 않는다.
- 서버 실행 환경, `ALIMTALK_RELAY_URL`, relay health, Vercel 환경변수, 운영 재배포 또는 장애 조사가 실제 범위일 때만 이 파일을 읽는다.
- 실제 외부 환경변수 변경, 재배포, 테스트 발송과 운영 조치는 공통 승인 경계를 통과해야 한다.

## 환경변수와 일관성

- relay 연결 키는 `ALIMTALK_RELAY_URL`, `ALIMTALK_RELAY_ADMIN_URL`, `ALIMTALK_RELAY_SECRET`이다. 값이나 secret을 채팅·명령 인수·로그·증거 문서에 출력하지 않는다.
- 로컬 loopback HTTP relay는 개발/검사에서만 허용하고, loopback이 아닌 relay 전송 URL은 HTTPS 검증을 통과해야 한다.
- 승인 템플릿 코드나 relay 연결값이 바뀌면 공유 env 원본, 로컬 런타임과 승인된 Vercel Production 환경의 일관성을 같은 작업에서 확인한다.
- 로컬 파일 비교는 `npm run check:alimtalk-env`, Vercel Production 비교는 `npm run check:alimtalk-env:vercel`을 사용하며 결과는 값 대신 `same`, `different`, `local-missing`, `production-missing` 상태로 확인한다.
- `D:\petmanager`의 알림톡 env 변경 후 `npm run sync:alimtalk-relay-env`를 실행하고 relay 프로세스를 재시작한 다음 diagnostics를 확인한다.

## 상태 확인과 장애 진단

- 로컬 relay는 작업 소유 listener인지 확인한 뒤 시작하며, 일반 로컬 기준 health endpoint는 `127.0.0.1:14010/health`다. relay health가 통과하기 전에 3000 서버 재시작만으로 복구됐다고 판단하지 않는다.
- 로컬 본문·상태 확인에는 Next.js 서버와 `backend/alimtalk-relay`가 모두 필요하다. relay diagnostics 실패 시 Ssodaa body/status 확인은 `검증불가`로 보고한다.
- 장애 확인 순서는 relay `/health`, 필요한 환경 키 존재와 일치 상태, relay secret binding, provider key/sender binding, 승인 템플릿 코드, 실제 본문·버튼 계약 순서다.
- 코드 수정이나 env 저장만으로 완료라고 하지 않는다. 필요한 env sync, 프로세스 재시작, 일관성 검사, relay/template diagnostics와 승인된 경우의 운영 재배포까지 각각 확인한다.
- 불확실한 provider/relay 실패를 자동 재시도하지 않는다. 로그에는 안전한 오류 코드와 상태만 남기고 secret, auth header, 전체 provider body를 노출하지 않는다.

## 상세 운영 문서

- 환경 일관성 기준: `D:\petmanager\docs\alimtalk-env-consistency.md`
- 템플릿 전환·장애 확인 순서: `D:\petmanager\docs\admin-alimtalk-operation-guide.md`

