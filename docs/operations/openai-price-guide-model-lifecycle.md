# 사진 요금표 OpenAI 모델 운영·교체 절차

## 고정 경로와 설정 위치

- 앱과 웹은 사진 분석을 분리하지 않는다. 두 화면 모두 정본 분석 API `https://www.petmanager.co.kr/api/owner/price-guide-photo-import`를 사용한다.
- Vercel 프런트 프로젝트는 `petmanager`와 `petmanager-app`으로 분리되어 있어도, 사진 분석의 OpenAI 키·사용 스위치·모델 설정은 API를 제공하는 **`petmanager` 프로젝트의 Production 환경 한 곳**이 정본이다. `petmanager-app` 설정만 바꿔서는 정본 API의 동작이 바뀌지 않는다.
- `OPENAI_PRICE_GUIDE_ENABLED`는 소문자 문자열 `true`여야 켜진다. `TRUE`, `1`, 공백이 포함된 값은 켜진 것으로 처리하지 않는다.
- Vercel 환경변수 변경은 이미 만들어진 배포에 소급 적용되지 않는다. Production 새 배포가 그 값을 읽었는지 다시 확인한다.
- 민감값은 일반 환경 pull에서 `[SENSITIVE]`로 가려질 수 있다. 이를 실제 값으로 오판하지 않고 `vercel env run` 안에서 플래그와 모델 설정만 판정하며, OpenAI 키 원문은 출력하지 않는다.
- 사진 업로드와 AI 분석은 별도 단계다. `upload_intent`/업로드/완료 오류는 모델 교체로 해결되지 않으며, R2 저장소 및 업로드 경로부터 확인한다.

## 새 모델·이름 변경·더 저렴한 모델이 나왔을 때

운영 모델은 최신 모델 이름을 자동 추적하지 않고 정확한 모델 ID로 고정한다. 새 Luna 모델, 기존 모델의 가격·이미지 입력·Responses API·구조화 출력 변경, 지원 종료 공지가 있으면 이 절차를 다시 실행한다. “최저가”라는 상품 분류명만으로는 가격표 사진의 OCR 품질, 이미지 세부 모드, 계정 접근 가능성, 결과 스키마 호환성을 보장하지 않는다. 공급사 변경 공지를 정기적으로 확인하고, 변경이 없어도 분기마다 모델 문서와 가격을 다시 읽는다. 검토 결과와 확인 날짜를 이 문서의 변경 이력에 기록한다.

1. OpenAI 공식 **Models**, **Pricing**, **Images and vision**, **Deprecations** 문서를 확인한다. 마케팅 표시명이 아니라 API에 보낼 정확한 model ID, 이미지 입력, Responses API, 사용 중인 이미지 detail(`original`), 구조화 출력, 지원 종료일과 적용 가격을 기록한다. 공식 자료에 필요한 세부 호환성이 명시되지 않으면 호환된다고 가정하지 않는다.
2. 새 후보가 실제 계정에서 사용 가능한지 확인하고, 이미지 입력 비용을 공식 이미지 비용 계산 기준으로 산정한다. 텍스트 토큰 단가만 비교해 이미지 요청을 더 싸다고 판정하지 않는다.
3. 후보를 코드에 반영할 때 모델 설정과 비용 산식을 함께 갱신한다.
   - 허용 ID와 기본값: `apps/web/src/lib/server-env.ts`
   - 모델별 입력·출력 단가 및 실제 Responses 요청: `apps/web/src/server/price-guide-photo-import.ts`
   - Vercel 환경 검증 허용 ID: `apps/web/scripts/check-price-guide-ai-env-vercel.cjs`
   - 요금 계산·환경 검증 계약 테스트: `apps/web/tests/server/price-guide-photo-import.test.mjs`, `apps/web/tests/server/price-guide-ai-env-readback-contract.test.mjs`
4. 기존 fixture로 기존 모델과 후보 모델의 서비스명, 체급/견종, 가격 범위, 소요시간, 미확인 값 처리를 비교한다. 숫자·행 누락이나 자동 추정이 늘어나면 후보를 채택하지 않는다. 운영 사진을 OpenAI로 보내는 비교는 실제 사용료가 발생하므로, 승인된 비민감 시험 사진만 사용하고 호출 횟수를 기록한다.
5. 테스트와 가격표 인식 품질 확인이 끝난 뒤에만 `OPENAI_PRICE_GUIDE_MODEL` 또는 코드 기본값을 명시적으로 바꾼다. 지원 ID 목록 밖 모델은 기본값으로 조용히 대체하지 않고 배포 검사에서 실패시킨다. 이전 검증 모델은 알려진 정상 복구 대상으로 유지한다.
6. 설정은 Vercel **`petmanager` → Production**에 적용한다. `OPENAI_PRICE_GUIDE_ENABLED=true`와 모델 ID를 확인하고, 새 Production 배포의 release SHA와 환경 검사를 읽어 본다. 기존 배포 재사용만으로 환경변수가 반영됐다고 판단하지 않는다.
7. `www.petmanager.co.kr`에서 업로드 준비 → 업로드 완료 → 분석 응답 → 요금표 검토/저장까지 한 번에 확인한다. 분석 요청이 OpenAI에 도달했는지는 provider 로그의 안전한 실패 분류와 요청 ID로 확인하고, 키·사진·개인정보·원문 prompt는 로그나 증거에 남기지 않는다.
8. 실패 시 최근 정상 model ID와 정상 배포로 되돌리고 같은 Production 경로에서 다시 확인한다. 모델 전환 기록에 날짜, 이전/신규 ID, 공식 근거 링크, 코드 SHA, 테스트 결과, 시험 호출 수와 사용료 확인 여부를 남긴다.

## 배포 전 통과 조건

- Production 모델/사용 스위치 readback 통과. 진단 로그에는 플래그 값, 모델 ID와 기본값/명시값 여부만 보여 주고 OpenAI 키 값은 절대 출력하지 않는다.
- 지원 모델 ID, 모델별 가격 계산, 이미지 입력 옵션, JSON 결과 계약을 검사하는 집중 테스트 통과.
- 정본 업로드 저장소 설정과 업로드 준비 경로 통과. 이 단계 실패는 AI 모델 테스트와 분리해 처리.
- Root production predeploy gate 통과. 실패한 게이트를 우회해 `www.petmanager.co.kr`에 배포하지 않는다.
- 배포 후 `www.petmanager.co.kr`의 runtime release 및 controlled end-to-end 분석 확인 통과.

## 현재 기본 원칙

- 모델 선택은 서버에서 명시적으로 고정하며, OpenAI의 “최신” 또는 “최저가”를 매 요청마다 자동 추적하지 않는다.
- 현재 코드 기본 모델은 `gpt-6-luna`다. `gpt-5.6-luna`는 명시적 환경 설정을 통한 복구 후보로 허용한다. 기존 Production 환경에 모델 ID가 명시돼 있으면 코드 기본값을 바꿔도 그 설정이 우선한다.
- 다음 모델로 이동할 때는 후보 ID를 먼저 허용 목록에 넣고 문서·가격·이미지 API 호환성·비용 계산·품질 fixture를 검증한다. 검증과 운영 설정 변경은 분리하며, 운영 설정 및 배포는 별도 승인 후 진행한다. 새 모델이 나왔다는 이유만으로 자동 배포하지 않는다.
- 입력 이미지 원본 및 개인 자료는 테스트 fixture에 커밋하지 않는다. 시험은 합성·비민감 사진을 사용한다.

## 모델 변경 이력

- 2026-10-01: 기본값을 `gpt-5.6-luna`에서 `gpt-6-luna`로 변경. OpenAI 공식 모델 문서는 Responses API와 이미지 입력을 지원하고, 표준 입력/출력 단가는 1M 토큰당 $0.10/$0.50로 안내한다. 품질 비교를 위한 추가 유료 호출 및 Production 설정 변경·배포는 이 코드 변경에 포함하지 않는다.

## 자동 업데이트 상태

- 2026-10-01 기준: 새 모델 감시, 사용자 알림, 자동 Production 업로드를 실행하는 예약 작업은 아직 없다. 위 변경 절차는 문서 기준이며, 새 모델이 나와도 현재는 자동 추천이나 배포가 발생하지 않는다.
- 자동화는 OpenAI 공식 모델·가격 정보를 확인하고, 호환성·비용·비민감 fixture 품질 검증을 통과한 경우에만 배포하도록 구성한다. 검증이 불명확하거나 실패하면 기존 모델을 유지하고 추천 결과만 알린다.
- 자동 실행에 필요한 OpenAI canary 자격증명과 배포 권한은 CI/Vercel 측 안전한 secret 저장소에서 제공되어야 한다. Production의 OpenAI 비밀키를 GitHub에 복사하지 않는다.
