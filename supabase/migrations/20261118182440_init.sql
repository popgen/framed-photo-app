-- Mi Fotito schema. Pricing rules live in src/lib/pricing.ts (20% on the second frame,
-- 15% from the third, gift wrap S/ 10, referral S/ 15). Keep this file in step with that module.

create extension if not exists pgcrypto;

create table public.campaigns (
  id text primary key,
  name text not null,
  active boolean not null default false,
  config jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.inventory (
  sku text primary key,
  name text not null,
  quantity integer not null check (quantity >= 0),
  low_stock_at integer not null default 5
);

create table public.frames (
  id text primary key,
  name text not null,
  size_label text not null,
  tier text not null,
  tier_label text not null,
  price_cents integer not null,
  print_w_cm numeric not null,
  print_h_cm numeric not null,
  outer_w_cm numeric not null,
  outer_h_cm numeric not null,
  moulding_cm numeric not null,
  aspect text not null,
  material text not null,
  mat boolean not null default false,
  stand boolean not null default false,
  hanging boolean not null default false,
  consumes jsonb not null,
  blurb text not null,
  sort integer not null
);

create table public.reviews (
  id text primary key,
  author text not null,
  city text not null,
  quote text not null,
  stars integer not null default 5,
  sort integer not null
);

create table public.promo_codes (
  code text primary key,
  kind text not null check (kind in ('percent', 'fixed')),
  value integer not null,
  expires_at timestamptz,
  max_uses integer,
  used_count integer not null default 0,
  active boolean not null default true,
  note text
);

create table public.gift_cards (
  code text primary key,
  initial_cents integer not null,
  balance_cents integer not null,
  buyer_name text,
  buyer_phone text,
  recipient_name text,
  recipient_phone text,
  recipient_email text,
  message text,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table public.referrals (
  code text primary key,
  owner_phone text not null,
  owner_name text,
  friend_discount_cents integer not null default 1500,
  referrer_credit_cents integer not null default 1500,
  redeemed_count integer not null default 0,
  order_id uuid,
  created_at timestamptz not null default now()
);

create table public.credits (
  phone text primary key,
  balance_cents integer not null default 0
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  public_token text not null unique,
  number text not null unique,
  status text not null,
  customer_name text not null,
  phone text not null,
  email text,
  recipient_name text,
  recipient_phone text,
  gift_note text,
  gift_wrap boolean not null default false,
  address_line text not null,
  district text not null,
  province text not null,
  city text not null,
  department text not null,
  reference text,
  zone text not null check (zone in ('lima', 'provinces')),
  subtotal_cents integer not null,
  frame_discount_cents integer not null default 0,
  frame_discount_label text,
  promo_code text,
  promo_discount_cents integer not null default 0,
  referral_code text,
  referral_discount_cents integer not null default 0,
  credit_applied_cents integer not null default 0,
  gift_card_code text,
  gift_card_applied_cents integer not null default 0,
  gift_wrap_cents integer not null default 0,
  total_cents integer not null,
  payment_method text,
  payment_status text not null default 'pending',
  payment_provider text,
  payment_ref text,
  tracking_number text,
  christmas_guaranteed boolean,
  christmas_note text,
  eta_min date,
  eta_max date,
  eta_label text,
  referral_code_issued text,
  replacement_for uuid,
  channel text not null default 'web' check (channel in ('web', 'whatsapp')),
  needs_human boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  frame_id text not null references public.frames(id),
  photo_path text,
  crop jsonb not null,
  orientation text not null default 'portrait',
  quantity integer not null default 1,
  unit_price_cents integer not null,
  bundle_id text,
  bundle_label text,
  dpi integer,
  resolution_status text,
  blurry boolean not null default false,
  blurry_note text
);

create table public.claims (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  phone text not null,
  note text,
  photo_path text,
  status text not null default 'open',
  replacement_order_id uuid references public.orders(id),
  created_at timestamptz not null default now()
);

create table public.notification_log (
  id uuid primary key default gen_random_uuid(),
  order_id uuid,
  channel text not null,
  to_address text not null,
  body text not null,
  event text,
  created_at timestamptz not null default now()
);

create table public.wa_events (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  token text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

create table public.app_settings (
  key text primary key,
  value text not null
);

insert into public.app_settings (key, value) values ('payments_mode', 'mock')
on conflict (key) do nothing;

alter table public.campaigns enable row level security;
alter table public.inventory enable row level security;
alter table public.frames enable row level security;
alter table public.reviews enable row level security;
alter table public.promo_codes enable row level security;
alter table public.gift_cards enable row level security;
alter table public.referrals enable row level security;
alter table public.credits enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.claims enable row level security;
alter table public.notification_log enable row level security;
alter table public.wa_events enable row level security;
alter table public.admin_users enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.admin_users where user_id = auth.uid());
$$;

create policy "frames are public" on public.frames for select using (true);
create policy "inventory is public" on public.inventory for select using (true);
create policy "reviews are public" on public.reviews for select using (true);
create policy "active campaign is public" on public.campaigns for select using (active);
create policy "admin reads own row" on public.admin_users for select to authenticated using (user_id = auth.uid());
create policy "admin all orders" on public.orders for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin all items" on public.order_items for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin promos" on public.promo_codes for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin gifts" on public.gift_cards for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin referrals" on public.referrals for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin claims" on public.claims for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin notes" on public.notification_log for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin stock" on public.inventory for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin campaign" on public.campaigns for update to authenticated using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit) values ('photos', 'photos', false, 10485760)
on conflict (id) do update set file_size_limit = excluded.file_size_limit;

create policy "anon uploads" on storage.objects for insert to anon
with check (bucket_id = 'photos' and name like 'uploads/%');

create policy "admin reads photos" on storage.objects for select to authenticated
using (bucket_id = 'photos' and public.is_admin());
