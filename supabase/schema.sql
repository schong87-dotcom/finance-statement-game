-- 게임 기록을 사용자별로 저장하는 테이블과 행 단위 접근 정책
-- Supabase 대시보드 > SQL Editor 에 붙여넣어 실행한다. 여러 번 실행해도 안전하다.

create table if not exists public.game_records (
  id         bigint generated always as identity primary key,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  game_id    text        not null,
  time_sec   integer     not null check (time_sec >= 0),
  created_at timestamptz not null default now()
);

-- 사용자별·게임별 최신순 조회가 유일한 접근 패턴이다
create index if not exists game_records_user_game_idx
  on public.game_records (user_id, game_id, created_at desc);

-- anon key는 브라우저에 공개되므로 실제 방어선은 여기다
alter table public.game_records enable row level security;

drop policy if exists "본인 기록만 조회" on public.game_records;
create policy "본인 기록만 조회" on public.game_records
  for select using (auth.uid() = user_id);

drop policy if exists "본인 기록만 추가" on public.game_records;
create policy "본인 기록만 추가" on public.game_records
  for insert with check (auth.uid() = user_id);

drop policy if exists "본인 기록만 삭제" on public.game_records;
create policy "본인 기록만 삭제" on public.game_records
  for delete using (auth.uid() = user_id);

-- update 정책은 두지 않는다. 한 번 남긴 기록은 수정할 수 없다.
