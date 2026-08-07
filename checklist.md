# 체크리스트 — Supabase 연동 + Vercel 재배포

## 0. 사전 확인
- [x] Vercel 프로젝트 이미 존재 확인 (`finance-statement-game`, 프로덕션 URL 활성)
- [x] GitHub 원격 연결 확인 (`schong87-dotcom/finance-statement-game`, PUBLIC)
- [x] 기존 코드 구조 파악 — `Records`/`Auth`가 12개 지점에서 **동기** 호출됨
- [x] 방식 결정 — 이름+비밀번호 유지 / 기존 기록 자동 이관 / PAT로 프로젝트 생성

## 1. Supabase 프로젝트 생성
- [x] Personal Access Token 수령
- [x] Management API로 프로젝트 생성 — ref `cgkocnezpitydxrflxom`, region `ap-northeast-2`(서울)
- [x] status `ACTIVE_HEALTHY` 확인
- [x] Project URL + publishable key 획득

## 2. DB 스키마 + 보안
- [x] `game_records` 테이블 생성 — 컬럼 5개 실측 확인
- [x] RLS 활성화 확인 (`relrowsecurity = true`)
- [x] 정책 3개 확인 — SELECT/INSERT/DELETE 모두 `auth.uid() = user_id`
- [x] 인덱스 `game_records_user_game_idx` 생성
- [x] **실측 검증** — publishable key만으로
      · 조회 → `[]` (0행)
      · 삽입 → 401
      · 삭제 → 0건 (행 그대로 남음)
      · 로그인 토큰 + 남의 user_id 삽입 → 403

## 3. Auth 설정
- [x] `mailer_autoconfirm` false → **true** 로 변경 (이메일 확인 끔)
- [x] `password_min_length = 6` — 기존 앱 규칙과 이미 일치, 변경 불필요
- [x] **`@fsg.local` 도메인 실측 확인** — signUp 성공, access_token 즉시 발급됨

## 4. 클라이언트 코드
- [x] `js/supabase-config.js` 신규
- [x] `js/auth.js` 재작성 — 공개 API 동기 시그니처 유지
- [x] `js/app.js` 수정 — 부팅 세션 복원 + 대기 화면, 로그인·로그아웃 async화
- [x] `index.html` 수정 — supabase-js 2.112.2 UMD + config 로드
- [x] `js/game.js`, `js/writing.js` — **변경 없음** (설계대로)
- [x] 전 파일 `node --check` 통과

## 5. 기존 기록 이관
- [x] 첫 로그인 시 1회 벌크 삽입 구현
- [x] **실측 검증** — 로컬에 4개 시드(검증용 3 + 다른사람 1) → 검증용 3개만 이관, 타임스탬프 보존됨
- [x] 중복 이관 방지 마커 동작 확인

## 6. 로컬 검증 (실제 브라우저)
- [x] 로그인 → 모드 선택 화면 진입
- [x] **쓰기게임 1판 실제 완주** → "6초 만에 완료" 배너 → 서버에 행 생성 확인
- [x] 새로고침 후 세션·기록 유지 확인
- [x] 로그아웃 버튼 + 모달 동작 확인
- [x] 잘못된 비밀번호 거부 / 짧은 비밀번호 / 빈 이름 / 긴 이름 각각 올바른 메시지
- [x] 다른 사용자로 로그인 시 기록이 섞이지 않음 확인 (둘째 → 0건)
- [x] 기록 삭제가 메모리·서버 양쪽에 반영됨 확인
- [x] 콘솔 에러 확인 — 신규 계정 첫 로그인 시 나오는 400 1건은 정상 (없는 계정 로그인 시도 후 가입으로 넘어가는 설계)
- [x] 테스트 계정 정리 (users 0, records 0)

## 7. 배포
- [ ] 커밋 (의미 단위 분리)
- [ ] `git push` → Vercel 자동 배포
- [ ] 프로덕션 URL 실측 — 로그인 + 게임 완주 + 기록 저장
- [ ] README 갱신
