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

-- v2 sync keys (separate from v1 pacochis-* keys):
--   paradise-pass-requests
--   paradise-pass-exceptions
