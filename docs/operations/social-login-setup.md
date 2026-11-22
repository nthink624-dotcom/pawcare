# 웹 소셜 로그인 연결

대상은 `apps/web`의 `/login`과 `/owner/social-accounts`다. 이메일 로그인을 유지하고 네이버·카카오·구글 로그인을 추가했다. 모바일 앱의 외부 브라우저·딥링크 로그인은 별도 작업이다.

## 현재 결과

2026-11-06 기준, 검수용 `petmanager-dev`에서 세 공급자의 실제 로그인과 기존 매장 진입을 확인한 뒤 대표 승인으로 운영 설정·배포를 완료했다. 운영에서도 대표 소유 계정으로 네이버·카카오·구글 각각 실제 공급자 인증, PKCE 교환 200, 새 OAuth 세션, 원래 사용자와 정확히 같은 매장 1개, bootstrap 200 및 `/owner` 진입을 확인했다. 공급자 일반 공개 승인과 이 계정의 실제 로그인 성공은 구분한다.

| 공급자 | 검수용 실제 확인 결과 |
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

### 모바일과 설치 앱 복귀

- 모바일 웹은 `https://app.petmanager.co.kr/auth/social/callback/*`, 설치 앱은 `kr.petmanager.owner://auth/auth/social/callback/*`을 사용한다. 마지막 경로 하나는 요청마다 바뀌는 32자리 값이다. Supabase URL Configuration에서 운영에는 이 두 패턴을, 검수용에는 `http://127.0.0.1:3100/auth/social/callback/*`과 설치 앱 검수용 복귀 패턴만 추가한다. 기존 PC 복귀 주소와 공급자 측 Supabase `/auth/v1/callback`은 유지한다.
- Android와 iOS는 각 앱의 시스템 브라우저 연결을 사용한다. 복귀 시 앱이 시작한 요청과 일치하는 코드만 원래 WebView의 PKCE 검증값으로 교환하며, 인증 코드 외에 앱으로 토큰을 전달하지 않는다. 시작할 때 사용한 앱과 브라우저 탭에서만 로그인 완료를 처리한다.
- 현재 앱 바이너리가 복귀 연결을 포함해야 한다. 검수는 최신 Android·iOS 빌드에서 공급자별로 로그인 시작 → 브라우저 인증 → 앱 복귀 → 같은 매장 진입까지 확인한다. 취소, 다른 계정, 매장 없음, 늦은 복귀도 확인한다. 앱 화면에 버튼이 표시되는 것만으로 실기기 검수 또는 운영 승인을 완료 처리하지 않는다.
- iOS 스토어 배포 전에는 적용되는 Apple의 로그인 서비스 4.8 기준과 예외를 확인한다. 적용되는 경우 요구 조건을 충족하는 동등한 로그인 옵션과 설정을 검증한다.

- `/api/auth/social/providers`는 공급자별 사용 가능 여부만 반환한다. 비밀 설정은 노출하지 않으며 미설정·오류 시 이메일 로그인을 안내한다.
- `/auth/callback`은 PKCE code를 한 번 교환하고 기존 인증된 `GET /api/owner/shops`에서 권한을 확인한다. 공급자 이메일이나 metadata로 권한을 만들지 않는다.
- 매장이 없는 identity는 로컬 세션을 해제하고 기존 가입·로그인을 안내한다. 소셜 인증만으로 오너 가입, KCP 본인인증, 필수 약관 동의가 완료되지 않는다.
- 기존 계정 연결은 원래 사용자와 매장 권한을 유지한다. 다른 사용자 복귀, 만료·변조된 연결 정보, 취소·공급자 오류는 실패로 처리한다.

## 검증과 남은 경계

집중 인증 테스트 16개와 관련 lint는 통과했다. 로그인·연결 화면은 실제 전용 Chrome에서 1440·1024·430·390 CSS px 폭의 버튼·대기 상태·오류·가로 넘침을 확인했다. 선별 운영 소스의 일반 빌드와 TypeScript 검사는 통과했다. 정본 전체 웹 TypeScript 검사에는 기존 `demo/customer-care-report-preview/page.tsx:58`의 `shopPhone` 오류가 있어 정본 전체 검사 통과로 보고하지 않는다.

작업 전용 `.codex-work`의 공급자별 `social-login-*-live-verification.json`, 연결 검증, `social-login-kakao-transfer-verification.json`, `social-login-final-live-verification.json`에 검수용 결과를 보존했다. 소스 수정·검수용 실제 로그인 통과·운영 배포·공급자 공개 승인은 서로 다른 상태다.

최신 운영 배포 `dpl_Bs8qhYfYpcjtQvAbqfDX6KPwHV57`은 일반 빌드 검사 통과 후 `https://www.petmanager.co.kr`에 반영하고 별칭을 다시 확인했다. 기존 운영 파일 17개와 다른 업무를 보존한 별도 스냅샷으로 배포했다. 운영 공급자의 기존 자격증명과 네이버 OIDC 설정을 보존했다. 수동 연결 활성화와 정확한 운영 callback 저장 후 기존 설정 보존을 확인했다. 조회 응답을 병렬로 즉시 소비하도록 수정하고 읽기 대기 시간을 조정했으며, 일시적인 설정 조회 503·네트워크 실패는 한 번만 재시도한다. 인증·연결 쓰기는 자동 재시도하지 않는다.

운영 네이버 연결은 매장 없는 예전 계정에 붙어 있어 대표의 별도 명시적 승인 후 현재 매장 계정으로 공식 이전했다. 암호화 백업을 검증했고 예전 Auth 사용자·이메일·이메일 identity를 이전 후 다시 읽어 보존을 확인했다. Auth 사용자 삭제나 직접 DB·매장 멤버십 변경은 하지 않았다. 각 공급자의 최종 로그인은 이전 세션 재사용을 성공으로 오인하지 않도록 실제 공급자 요청, PKCE 교환, 새 세션 식별자와 원래 매장 집합까지 확인했다.

기존 `넘친Day` 앱은 2026-07-24 불필요한 이메일 제공정보 요청 사유로 반려됐으며, 대표 승인으로 2026-11-07 재검수를 접수했다. 이름·휴대전화번호 수집은 유지하고 이메일 제공정보 요청은 해제된 상태를 보존했다. 실제 운영 프로필의 두 정보와 활용처 설명, 기존 계정 연결·로그인 절차, 네이버 연결 완료 화면을 개인정보 마스킹한 3쪽 PDF로 보완했다. 재검수 신청서의 적용 형태는 현재 구현에 맞춰 `회원가입 없이 단순 로그인 인증에 적용`으로 선택했다.

제출 후 새로고침한 개발자센터 상태는 `검수요청`, 최종 요청일은 `2026.11.07`이다. 263자 소명문이 서버에 저장됐고 기존 첨부 6개를 보존한 채 새 증빙 PDF 3개 참조가 각 제출 항목에 추가돼 총 9개가 저장됐음을 확인했다. 새 첨부 3개를 내려받아 모두 원본 PDF와 SHA-256이 일치하는 것도 확인했다. 제공정보 선택·필수 항목은 제출 후 다시 읽어 변경 전 값과 일치함을 확인했다. 네이버 승인과 일반 이용자 공개 가능 여부는 별도 단계이며 아직 승인 완료로 보고하지 않는다. 증빙은 `output/pdf/naver-login-review-evidence-20261107.pdf`, 접수 기록은 `.codex-work/social-login-production-20261106/naver-review-submission-verified-20261107.json`에 있다.

공식 문서: [Supabase Google](https://supabase.com/docs/guides/auth/social-sign-in/auth-google), [Supabase Kakao](https://supabase.com/docs/guides/auth/social-sign-in/auth-kakao), [Custom OAuth/OIDC](https://supabase.com/docs/guides/auth/custom-oauth-providers), [Identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking), [카카오 로그인 REST API](https://developers.kakao.com/docs/ko/kakaologin/rest-api), [네이버 OIDC discovery](https://nid.naver.com/.well-known/openid-configuration).
