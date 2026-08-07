# 컨텍스트 노트 — Supabase 연동

작업 시작: 2026-08-08

## 배경

Vercel 배포는 이미 되어 있었다. 확인한 사실.
- Vercel 프로젝트 `finance-statement-game`, 프로덕션 URL `https://finance-statement-game.vercel.app`
- `.vercel/project.json`에 `projectId: prj_c2R2sLiP4wimlkpQF5Dyfdl5liq8` 링크됨
- GitHub 원격 `schong87-dotcom/finance-statement-game` (PUBLIC), push하면 자동 배포

따라서 이번 작업의 실질은 "배포"가 아니라 **저장소를 localStorage에서 Supabase로 옮기는 것**이다.

기존 상태의 문제.
- 비밀번호가 localStorage에 **평문**으로 저장됨 (`js/auth.js`의 `fsg.users`)
- 기록이 브라우저 단위라 다른 기기에서 안 보임

## 결정 1 — Records/Auth의 동기 시그니처를 유지한다

`Records.listFor / best / save / clear`는 `game.js`·`writing.js`의 렌더 함수 안에서
템플릿 리터럴을 만들며 **동기적으로** 호출된다 (총 12곳).

```
js/game.js:88, 439, 474, 475, 697
js/writing.js:101, 157, 192, 193, 420
```

이걸 async로 바꾸면 `successBannerHTML()`, `historyHTML()`, `renderGame()`이 전부
async가 되고 호출 체인 전체가 전염된다. 게임 로직 파일 2개(총 1,189줄)를 뜯게 된다.

대신 **메모리 캐시 방식**을 택했다.
- 로그인 직후 / 부팅 시 Supabase에서 그 유저의 전체 기록을 한 번 읽어 메모리에 적재 (hydrate)
- 이후 `listFor`/`best`는 메모리만 읽음 → 동기 유지
- `save`는 메모리를 먼저 갱신(낙관적)하고 Supabase 삽입은 백그라운드
- `clear`도 동일

결과: **`game.js`와 `writing.js`는 한 줄도 수정하지 않는다.** (CLAUDE.md 3항 — 외과적 변경)

트레이드오프: 삽입 실패 시 화면엔 기록이 보이지만 서버엔 없다.
→ 실패하면 토스트로 알리고, 다음 hydrate 때 자연스럽게 정정된다. 게임 기록이므로 이 정도 손실 허용.

## 결정 2 — 이름+비밀번호 UX 유지, 내부는 합성 이메일

Supabase Auth는 이메일이 필수다. 사용자가 기존 UX 유지를 선택했으므로
이름을 결정론적으로 이메일로 변환한다.

```
이름 "홍길동" → UTF-8 바이트 → hex → "u<hex>@fsg.local"
```

hex를 쓰는 이유. 한글은 이메일 local part에 못 들어가고, hex는 `[0-9a-f]`만 나오므로
어떤 이름이든 항상 유효한 주소가 된다. 결정론적이라 같은 이름은 항상 같은 계정으로 간다.

local part 상한 64자 → hex 60자 → UTF-8 30바이트 → 한글 10자까지 허용.

표시용 이름은 `auth.users.raw_user_meta_data.display_name`에 저장한다.
별도 프로필 테이블을 만들지 않는다 (단일 용도, 3항).

로그인 흐름.
1. `signInWithPassword` 시도
2. 실패(Invalid login credentials)면 `signUp` 시도 → 성공하면 신규 계정 (기존 "첫 로그인 = 자동 가입" 동작 재현)
3. `signUp`이 "already registered"면 → 비밀번호 불일치로 안내

한계. 실제 이메일이 아니므로 비밀번호 찾기가 불가능하다. 기존과 동일한 제약이라 수용.

### 확인 완료 — `@fsg.local` 통과
실제 signUp을 쳐서 확인했다. 이름 "테스트" → `ued858cec8aa4ed8ab8@fsg.local` 로 가입 성공,
`access_token`이 즉시 발급됐고 `display_name`도 정상 저장됐다. 도메인 교체 불필요.

## 결정 3 — anon key를 저장소에 커밋한다

빌드 과정이 없는 순수 정적 사이트라 환경변수 주입 지점이 없다.
Supabase anon(publishable) key는 **설계상 공개되는 키**이고, 실제 방어선은 RLS다.
어차피 배포되면 브라우저에서 그대로 보인다. 저장소가 PUBLIC이어도 문제 없다.

전제 조건. RLS가 반드시 켜져 있어야 한다. 이게 뚫리면 키 노출이 곧 데이터 노출이다.
→ 체크리스트 2번에서 anon key로 직접 조회해 차단되는지 실측한다.

절대 커밋하면 안 되는 것. `service_role` key, Personal Access Token.

## 결정 4 — 기존 localStorage 기록 1회 이관

첫 Supabase 로그인 시 그 브라우저의 `fsg.history`에서 같은 이름의 기록을 찾아 벌크 삽입.
`fsg.migrated.<user_id>` 마커로 중복 이관을 막는다.
원본 localStorage 데이터는 지우지 않는다 (되돌릴 여지를 남김).

## 결정 5 — 구글 로그인을 GIS에서 Supabase OAuth로 갈아탄다

2026-07-17에 이미 구글 로그인이 들어가 있었다 (커밋 `60b798b`, `4f32ca5`, `5a563c8`).
Google Identity Services(GIS)로 ID 토큰을 받아 브라우저에서 payload만 디코딩하고,
세션을 localStorage에 넣는 방식이었다. 백엔드가 없던 시절엔 타당한 선택이었다.

이번에 Supabase가 들어오면서 그대로 둘 수 없게 됐다.
새 `Records`는 **Supabase 세션이 있어야** 서버에 기록을 쓴다.
GIS로 로그인한 사용자는 Supabase 세션이 없으므로 `save()`의 `uid`가 null이 되어
기록이 화면에만 보이고 서버에는 한 줄도 안 남는다. 조용히 깨지는 종류라 더 나쁘다.

그래서 GIS를 걷어내고 `supabase.auth.signInWithOAuth({ provider: 'google' })`로 바꿨다.
- 인증 체계가 하나가 되어 구글 로그인 사용자도 기록이 동일하게 쌓인다
- 클라이언트 ID/시크릿은 Supabase가 들고 있고 `index.html`에서는 사라진다
- 토큰 검증을 브라우저가 아니라 Supabase가 한다 (기존엔 서버 검증이 아예 없었다)

표시 이름은 구글이 주는 `full_name`/`name`을 쓴다.
이름+비밀번호 계정의 `display_name`과 같은 자리에서 읽도록 `userFromSession()`에 폴백을 뒀다.

주의. **구글 계정과 이름+비밀번호 계정은 별개 계정이다.** 같은 사람이 두 방식으로 로그인하면
기록이 따로 쌓인다. 통합하려면 계정 연결(identity linking)이 필요한데 이번 범위 밖이다.

## 만들어진 리소스

- Supabase 프로젝트 `finance-statement-game`
  - ref `cgkocnezpitydxrflxom`, region `ap-northeast-2` (서울)
  - URL `https://cgkocnezpitydxrflxom.supabase.co`
  - 조직 `schong87-dotcom's Org` (기존 조직에 추가)
- 테이블 `public.game_records` + RLS 정책 3개 + 인덱스 1개

DB 비밀번호는 이 세션의 스크래치패드에만 있고 저장소에는 없다.
필요해지면 대시보드 Settings > Database 에서 재설정하면 된다 (앱은 DB 비밀번호를 쓰지 않는다).

## 삽질 기록 — 다음 사람이 같은 데 빠지지 말 것

**1. 프로젝트 준비 상태 체크를 잘못했다.**
`/auth/v1/health`를 apikey 헤더 없이 호출하면 401이 온다. 이걸 "아직 준비 안 됨"으로 오해해
8분을 폴링했다. 실제로는 생성 직후부터 ACTIVE_HEALTHY였다. 401은 인증 누락이지 미준비가 아니다.

**2. 원격이 3커밋 앞서 있는 걸 확인 안 하고 작업을 시작했다.**
로컬은 `c78b4dd`였는데 원격 `main`은 `5a563c8`이었다. 그 사이에 구글 로그인이 들어가 있었고,
하필 내가 통째로 재작성한 `js/auth.js`·`js/app.js`·`index.html`을 건드리는 커밋이었다.
push 단계에서 거부당해서야 알았다. 거부되지 않았거나 force로 밀었으면
프로덕션에서 돌아가던 기능이 조용히 사라졌을 것이다.
**파일을 재작성하기 전에 `git fetch`부터 하고 원격과의 차이를 본다.**

**3. Vercel이 GitHub에 연결돼 있다고 멋대로 단정했다.**
`.vercel/project.json`이 있고 GitHub 원격도 있길래 "push하면 자동 배포"라고 README에 썼다.
확인해 보니 **연결돼 있지 않았다.** 과거 배포는 전부 CLI로 한 것이었고(`vercel ls`의 Duration 3s,
git 소스 없음), push해도 프로덕션은 21일 전 버전 그대로였다.
배포된 파일을 직접 curl로 열어보고서야 알았다.
**배포는 "했다"가 아니라 "배포된 파일에서 새 코드를 확인했다"로 검증한다.**
이 프로젝트는 `vercel --prod`를 직접 실행해야 한다.

**4. API 키 두 개가 같은 이름이라 덮어썼다.**
`/v1/projects/{ref}/api-keys` 응답에서 `publishable`과 `secret`의 `name`이 **둘 다 `default`**다.
name으로 파일을 저장했더니 secret이 publishable을 덮어썼고, 그 상태로 RLS를 테스트해서
"anon이 남의 데이터를 다 읽는다"는 가짜 보안 결함을 만들어냈다.
secret 키는 RLS를 우회하는 게 정상 동작이다. **키는 `name`이 아니라 `type`으로 구분해야 한다.**

## 진행 기록

- 2026-08-08: 사전 조사 완료. Vercel/GitHub는 이미 연결됨을 확인. 방향 결정 3건 확정.
- 2026-08-08: Supabase 프로젝트 생성, 스키마·RLS 적용, 이메일 확인 끔.
  RLS를 publishable 키로 실측 검증(조회 0행/삽입 401/삭제 0건/타인 user_id 삽입 403).
- 2026-08-08: 로컬 브라우저로 전체 흐름 검증. 쓰기게임 1판 실제 완주해 서버 저장까지 확인.
  기존 기록 이관도 실측(다른 사람 기록은 안 딸려옴). 테스트 계정 전부 삭제.
