-- Horario Paradise Pass v2 — uses the same app_state table as horario-pacochis v1.
-- If you already ran supabase-go-live.sql in this project, you do NOT need to run this again.

create table if not exists public.app_state (
  key text primary key,
  value jsonb not null default 'null'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table public.app_state enable row level security;

drop policy if exists "app_state_all" on public.app_state;
create policy "app_state_all" on public.app_state
  for all using (true) with check (true);

-- Restrictive RLS (recommended before public launch):
-- drop policy if exists "app_state_all" on public.app_state;
-- create policy "app_state_read" on public.app_state for select using (true);
-- create policy "app_state_write" on public.app_state
--   for insert with check (updated_by is not null)
--   using (true);
-- Note: anon key remains in client; pair with Supabase Auth or Edge Function for real isolation.
--   paradise-pass-requests
--   paradise-pass-exceptions
--   paradise-pass-operational  (schedules, agents, forecasts, WBD, metas)
