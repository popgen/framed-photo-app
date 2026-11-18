-- Customers, internal MF order numbers, and security hardening.
-- MF-26-#### numbers are admin/internal only; customers track orders by phone (WhatsApp OTP).

-- 1. Private schema for security-definer helpers (not exposed through the Data API).
create schema if not exists private;
grant usage on schema private to authenticated, service_role;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(select 1 from public.admin_users where user_id = (select auth.uid()));
$$;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated, service_role;

-- Re-point admin policies at private.is_admin(), then drop the exposed public one.
drop policy if exists "admin all orders" on public.orders;
drop policy if exists "admin all items" on public.order_items;
drop policy if exists "admin promos" on public.promo_codes;
drop policy if exists "admin gifts" on public.gift_cards;
drop policy if exists "admin referrals" on public.referrals;
drop policy if exists "admin claims" on public.claims;
drop policy if exists "admin notes" on public.notification_log;
drop policy if exists "admin stock" on public.inventory;
drop policy if exists "admin campaign" on public.campaigns;
drop policy if exists "admin reads own row" on public.admin_users;
drop policy if exists "admin reads photos" on storage.objects;
drop policy if exists "inventory is public" on public.inventory;

create policy "admin all orders" on public.orders for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "admin all items" on public.order_items for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "admin promos" on public.promo_codes for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "admin gifts" on public.gift_cards for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "admin referrals" on public.referrals for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "admin claims" on public.claims for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "admin notes" on public.notification_log for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "admin stock" on public.inventory for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "admin campaign" on public.campaigns for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "admin reads own row" on public.admin_users for select to authenticated using (user_id = (select auth.uid()));
create policy "admin reads photos" on storage.objects for select to authenticated using (bucket_id = 'photos' and (select private.is_admin()));

drop function if exists public.is_admin();

-- 2. RLS on every remaining table.
alter table public.app_settings enable row level security;
create policy "admin settings" on public.app_settings for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "admin credits" on public.credits for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "admin wa events" on public.wa_events for select to authenticated using ((select private.is_admin()));

-- 3. Customers.
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  name text,
  email text,
  user_id uuid unique references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.customers enable row level security;
create policy "customer reads own row" on public.customers for select to authenticated using (user_id = (select auth.uid()));
create policy "admin customers" on public.customers for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

alter table public.orders add column if not exists customer_id uuid references public.customers(id) on delete set null;

-- 4. Internal order numbers: MF-26-1001, MF-26-1002, ...
create sequence if not exists public.order_number_seq start with 1001;
alter table public.orders alter column number set default ('MF-26-' || nextval('public.order_number_seq')::text);
alter table public.orders alter column public_token set default replace(gen_random_uuid()::text, '-', '');

create or replace function private.set_order_number()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.number is null or new.number = '' then
    new.number := 'MF-26-' || nextval('public.order_number_seq')::text;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists orders_set_number on public.orders;
create trigger orders_set_number before insert on public.orders
for each row execute function private.set_order_number();

-- 5. Indexes for foreign keys and phone lookups (tracking by phone).
create index if not exists orders_customer_id_idx on public.orders(customer_id);
create index if not exists orders_phone_idx on public.orders(phone);
create index if not exists orders_replacement_for_idx on public.orders(replacement_for);
create index if not exists order_items_order_id_idx on public.order_items(order_id);
create index if not exists order_items_frame_id_idx on public.order_items(frame_id);
create index if not exists claims_order_id_idx on public.claims(order_id);
create index if not exists claims_replacement_order_id_idx on public.claims(replacement_order_id);
create index if not exists wa_events_phone_idx on public.wa_events(phone);

-- 6. Photos bucket: private, images and voice notes only, 25 MB max.
insert into storage.buckets (id, name, public) values ('photos', 'photos', false)
on conflict (id) do nothing;
update storage.buckets
set public = false,
    file_size_limit = 26214400,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','image/heif','audio/webm','audio/mp4','audio/mpeg','audio/ogg','audio/aac','audio/x-m4a','application/pdf']
where id = 'photos';

-- Uploads only (no read/list/update) into uploads/ for visitors and signed-in customers.
drop policy if exists "anon uploads" on storage.objects;
create policy "anon uploads" on storage.objects for insert to anon, authenticated
with check (bucket_id = 'photos' and name like 'uploads/%');
