-- Santa a la Carrera. One row per email. The public columns of a submission are
-- nickname, email, email_hash, score, distance, zone, run_log, confirmed_at,
-- confirm_token (sha256 of the mail link), marketing_opt_in, created_at.
-- best_* keeps the last confirmed score on the leaderboard while a higher
-- attempt waits for a new confirmation. Inserts and updates only via the
-- service role. Visitors read the top 20 through the security-invoker view,
-- which calls a definer function kept in the unexposed private schema.

create table public.game_scores (
  id uuid primary key default gen_random_uuid(),
  nickname text not null check (char_length(nickname) between 2 and 20),
  email text not null,
  email_hash text not null unique,
  score integer not null check (score >= 0 and score < 10000000),
  distance integer not null check (distance >= 0),
  zone smallint not null check (zone between 1 and 4),
  run_log jsonb not null,
  confirmed_at timestamptz,
  confirm_token text,
  marketing_opt_in boolean not null default false,
  marketing_opt_in_at timestamptz,
  in_contest boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  best_score integer,
  best_nickname text,
  best_distance integer,
  best_zone smallint,
  best_confirmed_at timestamptz,
  best_in_contest boolean
);

comment on table public.game_scores is
  'Puntajes de Santa a la Carrera. El correo no es público. confirm_token guarda el sha256 del enlace.';

create index game_scores_best_idx
  on public.game_scores (best_score desc, best_confirmed_at asc)
  where best_confirmed_at is not null;

create index game_scores_token_idx
  on public.game_scores (confirm_token)
  where confirm_token is not null;

alter table public.game_scores enable row level security;

revoke all on table public.game_scores from public, anon, authenticated;
grant select, insert, update, delete on table public.game_scores to service_role;

create policy "no direct reads" on public.game_scores
  for select to anon, authenticated
  using (false);

create policy "no direct inserts" on public.game_scores
  for insert to anon, authenticated
  with check (false);

create policy "no direct updates" on public.game_scores
  for update to anon, authenticated
  using (false)
  with check (false);

create policy "no direct deletes" on public.game_scores
  for delete to anon, authenticated
  using (false);

create table public.game_submit_attempts (
  id bigint generated always as identity primary key,
  bucket text not null,
  created_at timestamptz not null default now()
);

create index game_submit_attempts_bucket_idx
  on public.game_submit_attempts (bucket, created_at desc);

alter table public.game_submit_attempts enable row level security;

revoke all on table public.game_submit_attempts from public, anon, authenticated;
grant select, insert, delete on table public.game_submit_attempts to service_role;
grant usage, select on sequence public.game_submit_attempts_id_seq to service_role;

create policy "no direct attempt reads" on public.game_submit_attempts
  for select to anon, authenticated
  using (false);

create or replace function private.game_leaderboard_rows()
returns table (
  nickname text,
  score integer,
  zone smallint,
  confirmed_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.best_nickname as nickname,
    s.best_score as score,
    s.best_zone as zone,
    s.best_confirmed_at as confirmed_at
  from public.game_scores as s
  where s.best_confirmed_at is not null
    and s.best_nickname is not null
    and s.best_score is not null
    and s.best_zone is not null
  order by s.best_score desc, s.best_confirmed_at asc
  limit 20;
$$;

revoke all on function private.game_leaderboard_rows() from public, anon, authenticated;
grant execute on function private.game_leaderboard_rows() to anon, authenticated, service_role;
grant usage on schema private to anon;

create or replace function public.game_leaderboard()
returns table (
  nickname text,
  score integer,
  zone smallint,
  confirmed_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select nickname, score, zone, confirmed_at from private.game_leaderboard_rows();
$$;

revoke all on function public.game_leaderboard() from public;
grant execute on function public.game_leaderboard() to anon, authenticated, service_role;

create view public.game_leaderboard
with (security_invoker = true) as
select nickname, score, zone, confirmed_at
from private.game_leaderboard_rows();

revoke all on table public.game_leaderboard from public;
grant select on table public.game_leaderboard to anon, authenticated, service_role;

comment on view public.game_leaderboard is
  'Top 20 confirmados: apodo, puntaje, zona y fecha. Sin correo.';
