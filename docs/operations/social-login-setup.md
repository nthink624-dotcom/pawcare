# 웹 소셜 로그인 연결

대상은 `apps/web`의 `/login`과 `/owner/social-accounts`다. 이메일 로그인을 유지하고 네이버·카카오·구글 로그인을 추가했다. 모바일 앱의 외부 브라우저·딥링크 로그인은 별도 작업이다.

## 현재 결과

2026-11-06 기준, 대표가 승인한 검수용 `petmanager-dev`에서 세 공급자의 실제 로그인과 기존 매장 진입을 확인했다. 운영 Auth 설정·배포·공개 서비스 검수는 수행하지 않았다.

| 공급자 | 실제 확인 결과 |
| --- | --- |
| 구글 | 대표가 계정 선택·동의를 직접 완료했다. `/owner` 복귀, 서버 사용자 인증 200, Google identity와 OAuth 인증 방식, 기존 매장 3개, 현재 매장 권한, 실제 Supabase bootstrap 200과 매장 일치, 화면 로딩 완료를 확인했다. |
| 네이버 | 기존 `넘친Day` 앱 관리자 계정으로 진행했다. 기존 매장 계정에 공식 연결한 뒤 일반 로그인도 통과했다. 원래 사용자와 매장 3개 유지, 현재 매장 권한·bootstrap 200, 연결 화면의 `연결됨`을 확인했다. |
| 카카오 | 펫매니저 앱 `1526085`에서 인증했다. 기존 매장 계정으로 공식 연결한 뒤 일반 로그인도 통과했다. 원래 사용자와 세 공급자 identity, 매장 3개·현재 매장 권한·bootstrap 200·화면 로딩 완료를 확인했다. |

공급자 활성 상태, 실제 인증, PKCE 교환, 서버 사용자·매장 API, bootstrap과 화면 진입을 각각 확인했다. 네이버의 일반 고객 사용 가능 여부와 서비스 검수·공개 승인은 별도 확인 사항이다.

## 검수용 공급자 설정

비밀키는 공급자/Supabase 설정에서만 사용하며 소스·문서·채팅·일반 로그에 기록하지 않는다. 변경 전 자격증명과 이번 연결 이전 상태는 작업 전용 폴더의 Windows 현재 사용자 DPAPI 백업으로 보존하고 복호화 결과를 메모리에서 검증했다.

| 로그인 | Supabase provider | 저장 후 확인한 설정 |
| --- | --- | --- |
| 네이버 | `custom:naver` | 기존 OIDC 공급자와 앱을 재사용했다. 공개 discovery에 맞춰 scope는 `openid`, `profile`이다. OIDC에서 이메일을 제공하지 않아 검수용 `email_optional`을 활성화했다. 기존 사용자 이메일·issuer·Client ID·PKCE·nonce 검사는 유지했다. 네이버 개발자 앱 설정은 수정하지 않았다. |
| 카카오 | `kakao` | 사업자·채널이 연결된 앱 `1526085`의 기존 기본 REST 키를 재사용했다. 기존 URI·키·로그인 및 비즈니스 시크릿·보안 활성 상태를 보존하고 검수용 Supabase callback만 추가했다. 공급자 저장 후 새로고침으로 자격증명 일치를 확인했다. |
| 구글 | `google` | `petmanager-owner-app` 프로젝트의 웹 클라이언트 `PetManager Web Development`를 사용한다. 검수용 origin과 Supabase callback을 저장하고 자격증명 일치를 확인했다. |

Supabase의 정확한 애플리케이션 복귀 주소는 `http://127.0.0.1:3000/auth/callback`이며 허용 목록 저장 후 다시 확인했다. Site URL은 기존 로컬 주소를 유지했다. 수동 identity 연결은 검수용에서 활성화했고 가입·익명 로그인·이메일 확인 설정은 보존했다.

공급자 콘솔에 등록하는 주소는 Supabase가 표시하는 `/auth/v1/callback`이다. 앱의 `/auth/callback`과 구분한다. 운영 callback이나 환경을 추정해 수정하지 않는다.

## 기존 계정 연결

대표는 공급자 이메일이 달라도 기존 펫매니저 계정에 연결해서 같은 매장을 쓰는 방식을 선택했다. 기존 매장 계정으로 로그인하고 프로필의 소셜 로그인 연결 화면을 연다. 서버 사용자 확인과 기존 매장 접근이 모두 통과해야 연결할 수 있다.

연결 시작 시 현재 사용자·공급자·시각을 해당 탭에 기록하고 Supabase의 공식 `linkIdentity`를 호출한다. 복귀 시 대기 정보의 유효기간과 공급자를 검사하고, 교환된 사용자가 원래 사용자와 같은지 확인한 뒤 기존 매장 API를 호출한다. 이메일 추정, 직접 Auth 테이블 수정, 매장 멤버십 추가로 권한을 부여하지 않는다.

카카오는 기존의 다른 Auth 계정에 연결되어 처음에는 `identity_already_exists`로 차단됐다. 실제 카카오 로그인과 공식 토큰 정보 API로 앱·외부 사용자 일치를 확인했다. 해당 계정에는 보존할 예전 연결과 이번 검수에서 추가한 연결이 함께 있었다. 암호화 백업 후 이번에 추가한 연결만 공식 `unlinkIdentity`로 해제하고 기존 매장 계정에 공식 연결했다. 원래 Auth 사용자·이메일·예전 identity는 보존했다. 중간 연결 실패 시 원래 계정으로 복구한 뒤 인증 상태를 갱신하여 완료했다. Auth 사용자 삭제·매장 및 고객 데이터 변경은 수행하지 않았다.

이 절차는 이번 대표 소유 테스트 연결에 한정한다. 일반 사용자의 다른 계정 충돌은 오류로 안내하며 자동 이전·자동 병합 기능은 제공하지 않는다.

## 인증·가입 경계

- `/api/auth/social/providers`는 공급자별 사용 가능 여부만 반환한다. 비밀 설정은 노출하지 않으며 미설정·오류 시 이메일 로그인을 안내한다.
- `/auth/callback`은 PKCE code를 한 번 교환하고 기존 인증된 `GET /api/owner/shops`에서 권한을 확인한다. 공급자 이메일이나 metadata로 권한을 만들지 않는다.
- 매장이 없는 identity는 로컬 세션을 해제하고 기존 가입·로그인을 안내한다. 소셜 인증만으로 오너 가입, KCP 본인인증, 필수 약관 동의가 완료되지 않는다.
- 기존 계정 연결은 원래 사용자와 매장 권한을 유지한다. 다른 사용자 복귀, 만료·변조된 연결 정보, 취소·공급자 오류는 실패로 처리한다.

## 검증과 남은 경계

집중 인증 테스트 12개와 관련 lint는 통과했다. 로그인·연결 화면은 실제 전용 Chrome에서 1440·1024·430·390 CSS px 폭의 버튼·대기 상태·오류·가로 넘침을 확인했다. 전체 웹 TypeScript 검사는 기존 `demo/customer-care-report-preview/page.tsx:58`의 `shopPhone` 오류가 남아 있어 전체 통과로 보고하지 않는다.

작업 전용 `.codex-work`의 공급자별 `social-login-*-live-verification.json`, 연결 검증, `social-login-kakao-transfer-verification.json`, `social-login-final-live-verification.json`에 비밀정보 없는 결과를 보존했다. 소스 수정·검수용 실제 로그인 통과·운영 배포·공급자 공개 승인은 서로 다른 상태다. 운영 적용은 별도 승인 후 설정·배포·운영 로그인 왕복을 확인해야 한다.

공식 문서: [Supabase Google](https://supabase.com/docs/guides/auth/social-sign-in/auth-google), [Supabase Kakao](https://supabase.com/docs/guides/auth/social-sign-in/auth-kakao), [Custom OAuth/OIDC](https://supabase.com/docs/guides/auth/custom-oauth-providers), [Identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking), [카카오 로그인 REST API](https://developers.kakao.com/docs/ko/kakaologin/rest-api), [네이버 OIDC discovery](https://nid.naver.com/.well-known/openid-configuration).
