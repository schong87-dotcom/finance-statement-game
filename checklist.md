# 구글 로그인 전환 체크리스트

- [x] Google Cloud Console에서 OAuth 클라이언트 ID 생성 (gws-cli 프로젝트, 웹 애플리케이션)
  - 승인된 JS 원본: https://finance-statement-game.vercel.app, http://localhost:3000, http://localhost:8000
- [x] index.html에 Google Identity Services 스크립트 추가
- [x] auth.js: 이름+비밀번호 로그인 제거, 구글 credential(JWT) 처리로 교체
- [x] app.js: 로그인 화면을 구글 로그인 버튼으로 교체
- [x] 로컬 서버(localhost:8000)에서 동작 확인
  - 버튼 렌더링·계정 선택 팝업 오픈 확인, 세션 주입으로 로그인 후 화면·로그아웃 확인
  - 실제 구글 계정 클릭까지의 최종 확인은 사용자 몫 (팝업은 자동화 제어 불가)
- [x] 커밋 → 푸시 → 드래프트 PR
