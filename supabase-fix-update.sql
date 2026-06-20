-- 수정/삭제가 안 될 때 Supabase SQL Editor에서 이 파일을 한 번 실행하세요.
-- (이미 supabase-setup.sql 을 실행한 프로젝트용)

-- anon / authenticated 역할에 UPDATE·DELETE 권한 부여
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.transactions to anon, authenticated;

-- 기존 정책 정리 후 개별 정책 재생성
drop policy if exists "Allow all for transactions" on public.transactions;
drop policy if exists "transactions_select" on public.transactions;
drop policy if exists "transactions_insert" on public.transactions;
drop policy if exists "transactions_update" on public.transactions;
drop policy if exists "transactions_delete" on public.transactions;

create policy "transactions_select"
  on public.transactions for select
  to anon, authenticated
  using (true);

create policy "transactions_insert"
  on public.transactions for insert
  to anon, authenticated
  with check (true);

create policy "transactions_update"
  on public.transactions for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "transactions_delete"
  on public.transactions for delete
  to anon, authenticated
  using (true);
