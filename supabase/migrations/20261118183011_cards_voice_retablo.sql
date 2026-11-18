alter table public.frames add column if not exists border jsonb;
alter table public.frames add column if not exists category text;
alter table public.frames add column if not exists style text;

alter table public.order_items add column if not exists text_overlay jsonb;
alter table public.order_items add column if not exists card jsonb;
alter table public.order_items add column if not exists voice jsonb;

create table if not exists public.retablo_inquiries (
  id uuid primary key default gen_random_uuid(),
  size text not null check (char_length(size) between 2 and 280),
  status text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  created_at timestamptz not null default now()
);

create table if not exists public.voice_notes (
  token text primary key,
  seconds numeric,
  mime text,
  created_at timestamptz not null default now()
);

alter table public.retablo_inquiries enable row level security;
alter table public.voice_notes enable row level security;

create policy "anyone can ask about a retablo" on public.retablo_inquiries
  for insert to anon, authenticated with check (char_length(size) between 2 and 280);
create policy "admin reads retablo inquiries" on public.retablo_inquiries
  for select to authenticated using (public.is_admin());
create policy "admin updates retablo inquiries" on public.retablo_inquiries
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "public can open a voice note" on public.voice_notes
  for select using (true);
create policy "anyone can save a voice token" on public.voice_notes
  for insert to anon, authenticated with check (char_length(token) between 8 and 64);
