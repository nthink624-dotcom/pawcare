# 매장 정보 고객 화면 미리보기

목표: 기본 정보·프로필 관리·영업 시간에서 수정 중인 내용을 실제 고객 예약 화면과 같은 휴대폰 목업으로 표시한다.

분류: NORMAL. 제품 작성자 1명. 경로 localhost:3000/demo/owner-web?screen=shopInfo. 확인 폭 1440/1024/390.

결정: 기존 CustomerPagePhonePreview와 고객 예약 진입 컴포넌트를 재사용한다. PC는 독립된 오른쪽 카드, 1280px 미만은 접근 가능한 native dialog를 여는 버튼이다. 미리보기는 현재 편집값 projection이며 별도 저장 데이터나 API를 만들지 않는다. 이미지 asset 자동 갱신이 제거한 편집 사진을 복원하지 않도록 미리보기에서는 현재 이미지 URL을 사용한다. 영업 시간은 목록을 펼친다.

변경 파일: settings-shop-info-panel.tsx, settings-management-screen.tsx, customer-page-phone-preview.tsx, customer-booking-entry-page.tsx, operating-hours-settings.tsx. 모두 apps/web/src/components 아래 기존 파일이다. 예약 정책 탭 등 기존 미커밋 변경을 보존했다.

검증: TypeScript noEmit exit 0, diff whitespace 검사 exit 0. 전용 Chrome의 데모 화면에서 세 탭 × 세 폭에 목업 표시/모바일 열기·닫기/페이지 가로 넘침 없음 확인. 데모 매장명과 직원 소개를 변경한 즉시 고객 미리보기 반영을 확인하고 원래 값으로 돌렸다. 왼쪽 스크롤 후 오른쪽 위치 유지 확인. 편집 영역이 좁아져 발생한 영업 시간·휴무 달력 겹침은 compact 영역의 container query로 수정하고 화면 확인했다. 실제 운영 데이터 저장이나 물리 휴대폰 검증이 아니다.

정리: 기존 서버 3000/PID15640, 전용 Chrome PID12800/CDP5171 유지. 작업에서 새 브라우저/서버 프로세스는 시작하지 않았다. 확인 탭 B3C1296D07725C871891FC20934B12ED, 15D98BABD954E7188EB054009CAF381D, 36FCF3FE6DCECE43FBAB01BA901A6994는 각각 종료 조회 확인. 검사 Node 명령 종료. 운영 DB 쓰기/커밋/머지/배포 없음.

현재 UI 요청의 blocker는 없다. 다음 단계는 별도 승인된 출시 절차이며 예약금 기능의 남은 작업은 기존 구현 기록에서 이어간다.
