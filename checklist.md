# 구글 로그인 추가 체크리스트

- [x] index.html: GIS(Google Identity Services) 스크립트 + GOOGLE_CLIENT_ID 설정 추가
- [x] js/auth.js: Auth.signInWithGoogle() 추가 (최초 로그인 시 자동 계정 생성)
- [x] js/app.js: 로그인 화면에 "또는" 구분선 + 구글 로그인 버튼 렌더링
- [x] js/app.js: ID 토큰(JWT) 디코딩 → 이름/이메일로 세션 생성
- [x] 클라이언트 ID 미설정 시 안내 문구 표시 (에러 대신 graceful degradation)
- [x] README.md: 구글 로그인 설정 방법 추가
- [x] 로컬 서버 실행 후 화면 렌더링 확인 (버튼 렌더링·안내 문구 모두 확인)
- [ ] 실제 GOOGLE_CLIENT_ID 발급 후 index.html에 입력 (사용자 작업)
