# 대표 확인 질문 순서

한 번에 아래 질문을 모두 보내지 않습니다. 앞 질문의 답이 다음 작업을 바꾸므로 항상 한 질문씩 확인합니다. 비밀번호·2FA·연락처·법적 개인정보는 채팅으로 받지 않고 Play Console 또는 승인된 secure surface에서 대표가 직접 입력합니다.

1. **Android 앱에서 신규 구독·플랜 변경·결제수단 등록·유료 충전을 허용할까요, 아니면 PC에서만 결제하는 consumption-only 앱으로 고정할까요?**
   - 이유: Play 결제 정책, 금융 기능 선언, Data Safety, 스토어 문구와 exact release UI가 모두 이 결정에 달려 있습니다.
2. **서비스 이용자는 성인 미용샵 운영자·직원만이며 최소 이용 연령을 18세로 운영할까요?**
   - 이유: 타깃층 선택과 약관·가입 제한을 일치시켜야 합니다.
3. **PetManager는 정부기관 제작·위탁·공식 제휴 앱이 아니고 정부 정보를 제공하지 않는 것이 맞나요?**
   - 이유: 정부 앱 선언은 사업 사실이라 소스만으로 확정하지 않습니다.
4. **앱은 수의 진단·치료·의료 추천 없이 미용 기록과 참고 메모만 제공하는 것이 맞나요?**
   - 이유: 반려동물 체중·상태 메모와 건강 앱 선언의 경계를 확정합니다.
5. **직원 메모·사진은 매장 내부 기록이며 일반 사용자에게 공개·공유되는 소셜 UGC가 없는 것이 맞나요?**
   - 이유: 콘텐츠 등급과 Data Safety 답변에 필요합니다.
6. **[사용 여부 완료] Supabase, Cloudflare R2, Firebase Cloud Messaging, OpenAI, DeepSeek, PortOne/NHN KCP/PASS, 쏘다 알림톡을 운영에서 사용합니다. 다음으로 쏘다 Production 발송 경로의 server→relay(있는 경우)→쏘다 각 hop이 모두 HTTPS인지 예/아니요로 확인할 수 있나요?**
   - 이유: provider 사용 여부는 닫혔지만 쏘다 source는 runtime URL의 HTTPS scheme을 강제하지 않습니다. URL·host·credential 없이 boolean만 확인하며, 이 값이 없으면 Data Safety의 전송 중 암호화 `예`를 확정할 수 없습니다.
7. **공개 개인정보처리방침의 고객지원 연락처와 법정 보존기간을 대표가 최종 확인할 수 있나요?**
   - 연락처 값은 채팅으로 보내지 말고 secure surface에서 직접 확인합니다.
8. **별도 승인 후 비식별 Play 심사 전용 계정을 만들까요?**
   - 로그인 이메일·비밀번호는 Play Console secure credential field에만 입력합니다.
9. **앱 이름·짧은 설명·상세 설명 초안을 이 방향으로 승인할까요?**
10. **비식별 exact release 화면으로 아이콘·Feature graphic·스크린샷 4장을 제작할까요?**

## 후속 구현 분할

1. 결제 노출 정책 확정 및 Android release UI 수정/검증.
2. 모바일 개인정보처리방침과 공개 정본 동기화.
3. exact release AAB의 SDK·권한·provider·데이터 경로 감사와 Data Safety matrix 확정.
4. 별도 외부 쓰기 승인 후 reviewer 계정 생성·회수 계획 검증.
5. D: 전용 비식별 스토어 그래픽 제작과 독립 UI 검수.
6. 11개 답을 대표와 한 항목씩 확인한 뒤 별도 Play Console 쓰기 승인으로 저장.
