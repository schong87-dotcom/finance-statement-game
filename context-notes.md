# 구글 로그인 전환 — 컨텍스트 노트 (2026-07-17)

## 결정 사항

- **인증 방식: Google Identity Services(GIS) 클라이언트 전용.**
  정적 사이트(백엔드 없음)라 Firebase/Supabase 없이 GIS 버튼 + JWT 클라이언트 디코딩으로 처리.
  서버 검증이 없으므로 보안 등급은 기존 로컬 비밀번호 방식과 동일한 "학습용" 수준.
- **OAuth 클라이언트는 기존 `gws-cli` GCP 프로젝트(able-hull-493514-u4)에 생성.**
  golf-calculator도 같은 프로젝트를 쓰고 있고, 동의 화면이 이미 프로덕션(외부) 게시 상태라 재사용.
  클라이언트 ID: `450177760064-blrki3gdhcb8d9bqf1q3v2oifoo55d13.apps.googleusercontent.com` (공개값).
- **기록(Records) 키는 계속 `user.name`(구글 표시 이름).**
  game.js/writing.js 호출부를 안 건드리는 최소 변경이고, 기존 이름과 표시 이름이 같으면
  로컬 기록이 그대로 이어지는 마이그레이션 효과가 있음. 이메일은 세션에 보관만 함.
- **로그아웃 시 `google.accounts.id.disableAutoSelect()` 호출** — 원탭 자동 재로그인 방지.

## 주의

- GIS는 `file://`에서 동작 안 함. 로컬 테스트는 `python3 -m http.server 8000` 등 등록된 원본에서.
- 새 도메인(커스텀 도메인 등)을 붙이면 GCP 콘솔에서 승인된 JS 원본에 추가해야 함.
