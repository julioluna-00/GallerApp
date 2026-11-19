-- GallerApp stores app records in JSONB rows while keeping the current API shape.
-- Only the backend should access this table through the Supabase service role key.
create table if not exists public.app_state (
  key text primary key check (key in (
    'users',
    'events',
    'roosters',
    'fights',
    'bets',
    'wagers',
    'password-resets',
    'chat-messages'
  )),
  value jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;
revoke all on table public.app_state from anon, authenticated;
grant all on table public.app_state to service_role;
