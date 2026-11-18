-- Shared production data: order numbers, customers, OTP, photo paths.
-- Run after 20261118120000_init.sql and 20261118143000_cards_voice_retablo.sql.

create sequence if not exists public.order_number_seq start with 1001;

create or replace function public.next_order_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  n bigint;
  yy text;
begin
  n := nextval('public.order_number_seq');
  yy := to_char(timezone('America/Lima', now()), 'YY');
  return 'MF-' || yy || '-' || lpad(n::text, greatest(4, length(n::text)), '0');
end;
$$;

revoke all on function public.next_order_number() from public, anon, authenticated;
grant execute on function public.next_order_number() to service_role;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  phone text not null unique,
  name text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  address_line text not null,
  district text not null,
  province text not null,
  department text not null,
  city text,
  reference text,
  is_default boolean not null default false
);

alter table public.orders add column if not exists customer_id uuid references public.customers(id);
alter table public.order_items drop constraint if exists order_items_frame_id_fkey;
alter table public.order_items add column if not exists original_path text;
alter table public.order_items add column if not exists print_path text;
alter table public.voice_notes add column if not exists storage_path text;
alter table public.voice_notes add column if not exists phone text;

create table if not exists public.phone_otps (
  phone text primary key,
  code_hash text not null,
  salt text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.otp_sends (
  id bigint generated always as identity primary key,
  phone text not null,
  ip text not null,
  sent_at timestamptz not null default now()
);

create index if not exists otp_sends_phone_idx on public.otp_sends (phone, sent_at desc);
create index if not exists otp_sends_ip_idx on public.otp_sends (ip, sent_at desc);

alter table public.customers enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.phone_otps enable row level security;
alter table public.otp_sends enable row level security;

create policy "customer reads own profile" on public.customers
  for select to authenticated using (auth_user_id = auth.uid());
create policy "customer updates own profile" on public.customers
  for update to authenticated using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

create policy "customer reads own addresses" on public.customer_addresses
  for select to authenticated using (
    customer_id in (select id from public.customers where auth_user_id = auth.uid())
  );
create policy "customer inserts own addresses" on public.customer_addresses
  for insert to authenticated with check (
    customer_id in (select id from public.customers where auth_user_id = auth.uid())
  );
create policy "customer updates own addresses" on public.customer_addresses
  for update to authenticated using (
    customer_id in (select id from public.customers where auth_user_id = auth.uid())
  ) with check (
    customer_id in (select id from public.customers where auth_user_id = auth.uid())
  );
create policy "customer deletes own addresses" on public.customer_addresses
  for delete to authenticated using (
    customer_id in (select id from public.customers where auth_user_id = auth.uid())
  );

create policy "customer reads own orders" on public.orders
  for select to authenticated using (
    customer_id in (select id from public.customers where auth_user_id = auth.uid())
  );
create policy "customer reads own items" on public.order_items
  for select to authenticated using (
    order_id in (
      select id from public.orders
      where customer_id in (select id from public.customers where auth_user_id = auth.uid())
    )
  );

-- No policies on phone_otps or otp_sends: only the service role (Netlify) can read them.
