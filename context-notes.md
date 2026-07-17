# 컨텍스트 노트

## 2026-07-17 구글 로그인 추가

- **방식**: 백엔드가 없는 정적 앱이므로 Google Identity Services(GIS)의 클라이언트 사이드 로그인을 사용. ID 토큰(JWT)의 payload를 브라우저에서 디코딩해 이름/이메일만 추출한다. 서버 검증은 없음 — localStorage 기반 로컬 게임이라 보안 요구 수준에 맞는 선택.
- **클라이언트 ID**: `index.html`의 `window.GOOGLE_CLIENT_ID`에 입력. Google Cloud Console > API 및 서비스 > 사용자 인증 정보 > OAuth 클라이언트 ID(웹 애플리케이션)에서 발급. 승인된 JavaScript 출처에 `http://localhost:5173`, `http://127.0.0.1:5173` 등록 필요.
- **미설정 시 동작**: 클라이언트 ID가 비어 있으면 구글 버튼 자리에 설정 안내 문구를 표시. 기존 이름+비밀번호 로그인은 그대로 동작.
- **계정 저장 구조**: 구글 계정은 `fsg.users`에 `google:<이메일>` 키로 저장 (기존 이름 키와 충돌 방지). 세션의 `name`은 구글 프로필 이름 → 게임 기록(`fsg.history`)도 그 이름 기준으로 저장되므로 기존 Records 로직 변경 불필요.
- **file:// 제약**: GIS는 file:// 출처에서 동작하지 않음. 구글 로그인을 쓰려면 반드시 `python3 -m http.server 5173` 등으로 서빙해야 함.
