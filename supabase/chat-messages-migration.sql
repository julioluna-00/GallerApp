-- Run once in the Supabase SQL Editor to allow the backend to persist chat messages.
alter table public.app_state drop constraint if exists app_state_key_check;
alter table public.app_state
  add constraint app_state_key_check
  check (key in (
    'users',
    'events',
    'roosters',
    'fights',
    'bets',
    'wagers',
    'password-resets',
    'chat-messages'
  ));
