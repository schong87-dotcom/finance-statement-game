# 재무제표 학습 게임

재무제표 항목의 순서와 계층 구조를 드래그&드롭으로 익히는 웹 게임입니다.
노트북(마우스)과 모바일(터치)에서 모두 작동합니다.

## 실행 방법

빌드 과정 없이 정적 파일만 서빙하면 됩니다.

```bash
python3 -m http.server 5173
# → http://127.0.0.1:5173/ 접속
```

로그인·기록 저장이 Supabase를 거치므로 `index.html`을 파일로 직접 여는 방식(`file://`)은 쓰지 마세요.
반드시 HTTP로 서빙해야 합니다.

배포 주소는 https://finance-statement-game.vercel.app 입니다.
`main` 브랜치에 push하면 Vercel이 자동으로 배포합니다.

## 주요 기능

- **로그인**: 이름 + 비밀번호(6자리 이상). 최초 로그인 시 자동 계정 생성.
- **구글 로그인**: Supabase OAuth 기반. 클라이언트 ID·시크릿은 Supabase 대시보드에 두며
  앱 코드에는 들어가지 않습니다. `file://`로 열었을 때는 버튼 대신 안내 문구가 표시됩니다.
  - 구글 계정과 이름+비밀번호 계정은 **별개 계정**입니다. 기록이 합쳐지지 않습니다.
- **게임 선택**: 세 가지 게임 카드. 각 게임의 개인 최고 기록이 카드에 노출됩니다.
- **손익계산서 게임**: 10개 항목의 올바른 순서 맞추기
- **재무상태표 게임 1**: 11개 항목을 2단계 수준에 맞게 배치
- **재무상태표 게임 2**: 17개 항목을 3단계 계층 구조에 맞게 배치
- **조작 방식**
  - 데스크톱: 항목을 드래그해서 원하는 슬롯에 드롭
  - 모바일: 항목을 탭하여 선택 → 원하는 슬롯을 탭하여 배치
  - 슬롯의 항목을 탭하면 다시 좌측 목록으로 되돌아옵니다
- **타이머 + 기록 저장**: 기록이 Supabase에 계정 단위로 저장되어 다른 기기·브라우저에서도 이어집니다

## 파일 구조

```
.
├── index.html
├── supabase/
│   └── schema.sql          # game_records 테이블 + RLS 정책
└── js/
    ├── supabase-config.js  # Supabase URL / publishable key
    ├── data.js             # 3개 게임의 항목/정답/계층 정의
    ├── ui.js               # 공용 아이콘, 토스트, 모달
    ├── auth.js             # Supabase 인증 + 기록 저장 (읽기는 메모리 캐시)
    ├── game.js             # 드래그앤드롭 게임 화면
    ├── writing.js          # 쓰기게임 화면
    └── app.js              # 라우팅, 로그인 화면, 선택 화면
```

## Supabase

- 프로젝트 ref: `cgkocnezpitydxrflxom` (region: 서울)
- 기록은 `public.game_records` 한 테이블에만 쌓이고, RLS로 **본인 행만** 읽고 쓸 수 있습니다.
- `js/supabase-config.js`의 publishable key는 브라우저에 공개되는 것이 정상입니다.
  실제 방어선은 RLS이며, `service_role`/`secret` 키는 저장소에 절대 넣지 않습니다.
- 스키마를 다시 적용하려면 대시보드 SQL Editor에 `supabase/schema.sql`을 붙여넣어 실행하면 됩니다
  (여러 번 실행해도 안전합니다).

### 로그인 방식

화면에서는 이름+비밀번호를 받지만, 내부적으로는 이름을 UTF-8 hex로 편 뒤
`u<hex>@fsg.local` 형태의 이메일로 바꿔 Supabase Auth에 넘깁니다.
같은 이름은 항상 같은 계정으로 이어집니다.
실제 이메일이 아니므로 **비밀번호 찾기는 불가능합니다** (기존과 동일한 제약).

구글 로그인은 Supabase의 구글 provider를 씁니다. 설정 위치는 두 곳입니다.
- Supabase 대시보드 > Authentication > Sign In / Providers > Google — 클라이언트 ID·시크릿
- Google Cloud Console > 사용자 인증 정보 > 승인된 리디렉션 URI
  → `https://cgkocnezpitydxrflxom.supabase.co/auth/v1/callback`

## 원본 대비 변경 사항

- 첫 화면(로그인 화면)에서 **회원가입 탭 제거** — 최초 로그인 시 자동으로 계정이 생성되도록 통합
- 비밀번호 입력란의 placeholder를 **"6자리 이상"**으로 변경
- 비밀번호 표시/숨김 토글 버튼 추가
- 모바일 최적화(탭 기반 배치 인터랙션, 반응형 그리드, 고정 헤더)
