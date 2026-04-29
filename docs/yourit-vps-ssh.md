# YourIT VPS SSH Shortcut

## 빠른 접속

- 더블클릭용 스크립트: `D:\pawcare\scripts\ssh-yourit-vps.cmd`
- PowerShell 직접 실행: `D:\pawcare\scripts\ssh-yourit-vps.ps1`

현재 상태에서는 위 스크립트를 실행하면 아래 규칙으로 접속한다.

```powershell
ssh root@103.124.101.54 -p 22
```

- `C:\Users\happy\.ssh\id_ed25519` 키 파일이 있으면 그 키로 먼저 접속
- 위 키가 없고 `D:\pawcare\.local-secrets\yourit_vps_ed25519`가 있으면 그 키로 접속
- 둘 다 없으면 비밀번호 로그인

```powershell
ssh -i C:\Users\happy\.ssh\id_ed25519 root@103.124.101.54 -p 22
```

## 중요한 점

- 지금은 SSH 비밀번호 로그인이므로, 스크립트를 눌러도 비밀번호는 직접 입력해야 한다.
- 완전히 `클릭만 하면 접속 완료` 상태로 만들려면 SSH 공개키 로그인을 설정해야 한다.

## 완전 자동 접속 조건

1. 로컬 PC에서 `C:\Users\happy\.ssh\id_ed25519` 키 생성
2. 서버 `~/.ssh/authorized_keys`에 공개키 등록
3. 이후 스크립트 실행 시 비밀번호 없이 접속

## 다음 단계

- 비밀번호 입력까지 없애려면 SSH 키 로그인으로 전환한다.
