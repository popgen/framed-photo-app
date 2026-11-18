-- Not applied. Lucas runs this in the Supabase SQL editor.
-- Links each web order to the Supabase Auth user and lets that user read only their rows.
-- Phone tracking stays on the service role; this policy does not expose orders to anon.

alter table public.orders add column if not exists user_id uuid references auth.users(id) on delete set null;
create index if not exists orders_user_id_idx on public.orders (user_id);

drop policy if exists "customer reads own orders by user" on public.orders;
create policy "customer reads own orders by user" on public.orders
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "customer reads own order items by user" on public.order_items;
create policy "customer reads own order items by user" on public.order_items
  for select to authenticated
  using (order_id in (select id from public.orders where user_id = (select auth.uid())));

create table if not exists public.track_lookups (
  id bigint generated always as identity primary key,
  phone text not null,
  ip text not null,
  created_at timestamptz not null default now()
);
create index if not exists track_lookups_phone_idx on public.track_lookups (phone, created_at desc);
create index if not exists track_lookups_ip_idx on public.track_lookups (ip, created_at desc);
alter table public.track_lookups enable row level security;
