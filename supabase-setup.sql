-- Supabase 대시보드 > SQL Editor 에서 이 내용을 붙여넣고 "Run" 실행하세요.
-- 한 번만 실행하면 됩니다.

-- 1) 테이블 만들기
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  app_id text not null,
  date text not null,
  amount integer not null,
  category text not null,
  type text not null,
  place text,
  payment_method text not null,
  writer text not null,
  created_at bigint not null
);

-- 2) 누구나 읽기/쓰기 허용 (가계부 ID만 알면 접근 가능한 방식)
alter table public.transactions enable row level security;

create policy "Allow all for transactions"
  on public.transactions
  for all
  using (true)
  with check (true);

-- 3) 실시간 구독용: 이 테이블을 실시간(Realtime) 대상에 포함
-- "already in publication" 에러가 나면 이미 추가된 거라 무시하면 됨
alter publication supabase_realtime add table public.transactions;
