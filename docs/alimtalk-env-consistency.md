# 알림톡 환경값 일치 기준

## 원칙

운영 관페와 데브 관페의 알림톡 템플릿 코드는 항상 같아야 한다.

쏘다/카카오에서 승인된 템플릿 코드를 변경하거나 새로 연결하면 같은 작업 안에서 아래 두 곳을 함께 수정한다.

- 로컬 개발 환경: `.env.local`
- 운영 배포 환경: Vercel Production Environment Variables

데브와 운영의 템플릿 코드를 일부러 다르게 두는 것은 기본 운영 방식이 아니다. 임시 테스트 분리가 필요하면 오너가 명시적으로 승인한 경우에만 허용하고, 테스트가 끝나면 즉시 다시 맞춘다.

## 반드시 맞아야 하는 값

- `ALIMTALK_TEMPLATE_BOOKING_RECEIVED`
- `ALIMTALK_TEMPLATE_BOOKING_CONFIRMED`
- `ALIMTALK_TEMPLATE_BOOKING_REJECTED`
- `ALIMTALK_TEMPLATE_BOOKING_CANCELLED`
- `ALIMTALK_TEMPLATE_BOOKING_RESCHEDULED_CONFIRMED`
- `ALIMTALK_TEMPLATE_APPOINTMENT_REMINDER_10M`
- `ALIMTALK_TEMPLATE_GROOMING_STARTED`
- `ALIMTALK_TEMPLATE_GROOMING_ALMOST_DONE`
- `ALIMTALK_TEMPLATE_GROOMING_COMPLETED`
- `ALIMTALK_TEMPLATE_REVISIT_NOTICE`
- `ALIMTALK_TEMPLATE_BIRTHDAY_GREETING`

릴레이 연결값도 기본적으로 같은 기준으로 관리한다.

- `ALIMTALK_RELAY_URL`
- `ALIMTALK_RELAY_ADMIN_URL`
- `ALIMTALK_RELAY_SECRET`

## 확인 명령

로컬 파일끼리 비교:

```bash
npm run check:alimtalk-env
```

Vercel Production 값을 새로 내려받아 로컬 `.env.local`과 비교:

```bash
npm run check:alimtalk-env:vercel
```

이 명령은 실제 비밀값을 출력하지 않는다. 각 키가 `same`, `different`, `local-missing`, `production-missing` 중 무엇인지 확인한다.

## 승인 템플릿이 추가되거나 바뀐 날 할 일

1. 쏘다/카카오에서 승인 완료된 템플릿 코드를 확인한다.
2. `.env.local`의 해당 `ALIMTALK_TEMPLATE_*` 값을 수정한다.
3. Vercel Production Environment Variables에도 같은 값을 입력한다.
4. `npm run check:alimtalk-env:vercel`을 실행해 모두 `same`인지 확인한다.
5. 운영을 재배포한다.
6. 운영 관페 `/admin/alimtalk`에서 템플릿 연결 상태와 테스트 발송을 확인한다.

## 템플릿 불일치가 계속 뜰 때

템플릿 코드가 같아도 발송 본문이 쏘다 승인 본문과 다르면 `템플릿 불일치`가 뜬다.

이 경우에는 환경값 문제가 아니라 문구 문제다. `/admin/alimtalk`의 템플릿 비교 화면에서 쏘다 승인 본문과 PetManager 실제 발송 본문을 맞춘다.
