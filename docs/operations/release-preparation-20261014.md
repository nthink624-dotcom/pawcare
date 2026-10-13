# 출시 준비 수정과 남은 검증

검사 파일 누락과 가입·파일럿·피드백 테스트의 오래된 마이그레이션 경로를 수정했다. 가입 완료 API는 현재 v6 계약을 검사하며, 배포 전 검사에 해당 회귀 검사를 포함했다. 운영 검사는 로컬 개발 환경과 비교하지 않고 운영 설정을 직접 확인할 수 있다. Vercel이 민감 설정을 가리므로 AI 설정은 운영 readiness 응답의 비밀 없는 Boolean 값으로 읽는다. 값을 읽지 못한 상태를 잘못된 키 또는 비활성화로 판정하지 않는다.

예약금 기한 마이그레이션은 운영 이력의 `20261013145604`와 소스 SQL의 정규화된 해시가 같음을 확인하고 소스 파일명만 이력에 맞췄다. 운영 마이그레이션을 재실행하지 않았다.

## 백업과 복구

Windows 작업 `PetManager encrypted Supabase R2 backup`의 임시 CA 경로와 파일 ACL 설정 오류를 수정했다. CA는 보호 저장소의 지속 경로에 두고 기존 SHA-256을 확인한다. 파일 ACL은 관리자 권한 우회 없이 현재 사용자만 접근하도록 설정한다. 운영 읽기 전용 계정, TLS `verify-full`, PMDUMP02 암호화 및 R2 업로드 후 재다운로드 해시 검증을 유지한다. 객체 권한도 백업하며 원본 평문 dump와 임시 pgpass는 제거한다.

`scripts/run-encrypted-production-backup.ps1`는 설치된 작업의 정본이다. 실제 예약 작업 실행 결과 0과 새 R2 백업의 해시 일치를 확인했다. 매일 03:15 실행하지만 PC가 켜져 있고 해당 사용자가 로그인돼 있어야 한다. 24시간 이상 새 백업이 없으면 출시 검사에서 실패한다.

`scripts/verify-offline-production-restore.ps1`는 운영 연결 없이 임시 로컬 PostgreSQL에 복구한다. 복호화한 archive는 메모리에서 pg_restore로 전달하며 평문 dump 파일을 쓰지 않는다. 임시 DB는 localhost/SCRAM 비밀번호 인증을 사용하고 현재 사용자 ACL로 보호한다. 테이블 읽기, RLS, 중요 RPC의 서버 전용 실행 권한, service_role 조회를 확인하고 서버와 임시 데이터·비밀번호 파일을 정리한다. 현재 PC에서 DPAPI 키 및 USB 키 복구를 확인했다.

다른 Windows PC에서는 PostgreSQL 18 도구와 암호화 archive, USB 복구 키, 역할 manifest, 이 복구 스크립트만 준비한다. 실제로 다른 PC에서 다음 명령을 실행한다. 비밀번호나 키 내용은 입력·출력하지 않는다. USB NTFS 권한 때문에 파일을 읽을 수 없다면 해당 PC 관리자가 복구 파일의 접근 권한을 직접 확인해야 한다.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\verify-offline-production-restore.ps1 `
  -EncryptedBackupPath "<encrypted archive>" `
  -PortableKeyPath "<USB key file>" `
  -RoleManifestPath ".\production-backup-role-manifest.json" `
  -RecoverablePointAt "<backup receipt RecoverablePointAt>" `
  -BaselineDeviceFingerprint "<current-device restore receipt fingerprint>" `
  -ReceiptPath ".\second-device-restore.json"
```

다른 PC의 성공 영수증을 얻기 전에는 second-device 검증을 완료로 표시하지 않는다. DB 백업은 R2 미디어 객체를 포함하지 않는다.

## 남은 항목

- 운영 Supabase 조직은 현재 Free다. 유출 비밀번호 차단은 Pro 이상이며, 비용 한도 및 대표의 계정·결제 단계 확인 없이 유료 전환하지 않는다.
- 실제 가입·알림톡 수신·결제/환불 검증은 지정된 테스트 계정/번호와 펫매니저 전용 Chrome이 필요하다. 운영 고객을 대상으로 시험하지 않는다.
- 다른 PC USB 복구, 미디어 객체 백업/복구와 기타 미확인 출시 기준은 실제 증거가 필요하다. 구조 검사·빌드·배포 성공을 정식 출시 승인으로 간주하지 않는다.
