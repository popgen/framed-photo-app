-- Not applied on the live project yet. Run this after 20261118182536.
-- Adds the shop pieces that are not in the live schema: Christmas frames, stock the
-- storefront can read, order-line extras, addresses, OTP storage, retablos, and voice notes.
-- MF-26-#### stays internal. Customers never receive it.

alter table public.frames add column if not exists border jsonb;
alter table public.frames add column if not exists category text;
alter table public.frames add column if not exists style text;

alter table public.order_items add column if not exists text_overlay jsonb;
alter table public.order_items add column if not exists card jsonb;
alter table public.order_items add column if not exists voice jsonb;

-- Card lines use ids such as card-a6, which are not rows in frames.
alter table public.order_items drop constraint if exists order_items_frame_id_fkey;

-- Quantity only. The inventory table itself stays closed to visitors.
create or replace function public.public_stock()
returns table (sku text, quantity integer)
language sql
stable
security definer
set search_path = ''
as $$
  select i.sku, i.quantity from public.inventory as i;
$$;
revoke all on function public.public_stock() from public;
grant execute on function public.public_stock() to anon, authenticated;

-- One referral discount, without listing every code.
create or replace function public.lookup_referral(p_code text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select r.friend_discount_cents
  from public.referrals as r
  where upper(r.code) = upper(p_code)
  limit 1;
$$;
revoke all on function public.lookup_referral(text) from public;
grant execute on function public.lookup_referral(text) to anon, authenticated;

create or replace function public.lookup_gift_card(p_code text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select g.balance_cents
  from public.gift_cards as g
  where upper(g.code) = upper(p_code)
    and g.status = 'active'
  limit 1;
$$;
revoke all on function public.lookup_gift_card(text) from public;
grant execute on function public.lookup_gift_card(text) to anon, authenticated;

-- Active promo codes are typed by customers, so the checkout can price them.
drop policy if exists "active promos readable" on public.promo_codes;
create policy "active promos readable" on public.promo_codes
for select to anon, authenticated
using (active = true);

create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  address_line text not null,
  district text not null,
  province text not null,
  department text not null,
  city text not null,
  reference text,
  created_at timestamptz not null default now()
);
alter table public.customer_addresses enable row level security;
drop policy if exists "admin addresses" on public.customer_addresses;
create policy "admin addresses" on public.customer_addresses
for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create table if not exists public.phone_otps (
  phone text primary key,
  code_hash text not null,
  salt text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.phone_otps enable row level security;

create table if not exists public.otp_sends (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  ip text,
  sent_at timestamptz not null default now()
);
alter table public.otp_sends enable row level security;
create index if not exists otp_sends_phone_idx on public.otp_sends (phone, sent_at);
create index if not exists otp_sends_ip_idx on public.otp_sends (ip, sent_at);

create table if not exists public.retablo_inquiries (
  id uuid primary key default gen_random_uuid(),
  size text not null,
  status text not null default 'new',
  created_at timestamptz not null default now()
);
alter table public.retablo_inquiries enable row level security;
drop policy if exists "admin retablos" on public.retablo_inquiries;
create policy "admin retablos" on public.retablo_inquiries
for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));
drop policy if exists "anon creates retablo inquiry" on public.retablo_inquiries;
create policy "anon creates retablo inquiry" on public.retablo_inquiries
for insert to anon, authenticated
with check (char_length(size) between 1 and 80);

create table if not exists public.voice_notes (
  token text primary key,
  storage_path text not null,
  mime text,
  created_at timestamptz not null default now()
);
alter table public.voice_notes enable row level security;
drop policy if exists "anon inserts voice" on public.voice_notes;
create policy "anon inserts voice" on public.voice_notes
for insert to anon, authenticated
with check (storage_path like 'uploads/%');
drop policy if exists "admin reads voice" on public.voice_notes;
create policy "admin reads voice" on public.voice_notes
for select to authenticated
using ((select private.is_admin()));

drop policy if exists "admin wa events" on public.wa_events;
create policy "admin wa events" on public.wa_events
for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

-- Stock for the ten frames already in the live database, plus the Christmas bodies.
insert into public.inventory (sku, name, quantity, low_stock_at) values
  ('body-15-black', 'Cuerpo 15×20 negro', 20, 5),
  ('body-15-white', 'Cuerpo 15×20 blanco', 20, 5),
  ('body-15-wood', 'Cuerpo 15×20 madera', 18, 5),
  ('body-15-gold', 'Cuerpo 15×20 dorado', 4, 5),
  ('body-30-black', 'Cuerpo 30×40 negro', 16, 5),
  ('body-30-white', 'Cuerpo 30×40 blanco', 14, 5),
  ('body-30-wood', 'Cuerpo 30×40 madera', 14, 5),
  ('body-20-black', 'Cuerpo 20×20 negro', 20, 5),
  ('mat-white', 'Paspartú blanco', 12, 5),
  ('body-navidad-nieve', 'Cuerpo Navidad Nieve Celeste', 16, 5),
  ('body-navidad-acebo', 'Cuerpo Navidad Acebo', 16, 5),
  ('body-navidad-oro', 'Cuerpo Navidad Estrellas de Oro', 16, 5),
  ('body-navidad-retablo', 'Cuerpo Navidad Retablo', 16, 5),
  ('body-navidad-aguayo', 'Cuerpo Navidad Aguayo', 16, 5),
  ('body-navidad-noche', 'Cuerpo Navidad Noche Nevada', 16, 5),
  ('body-navidad-pino', 'Cuerpo Navidad Pino', 16, 5)
on conflict (sku) do nothing;

insert into public.frames (
  id, name, size_label, tier, tier_label, price_cents, print_w_cm, print_h_cm, outer_w_cm, outer_h_cm,
  moulding_cm, aspect, material, mat, stand, hanging, consumes, blurb, sort, border, category, style
) values
  ('nieve-celeste', 'Nieve Celeste', '15×20 cm', 'basic', 'Navidad', 7900, 15, 20, 19.4, 26, 2.2, '3:4', 'white', false, true, false, '[{"sku":"body-navidad-nieve","qty":1}]', 'Celeste claro, con nieve, muñeco y arbolito en el marco. El borde de abajo es más alto.', 11, '{"top":2.2,"right":2.2,"bottom":3.8,"left":2.2}', 'navidad', 'traditional'),
  ('acebo-clasico', 'Acebo Clásico', '15×20 cm', 'basic', 'Navidad', 7900, 15, 20, 19.8, 24.8, 2.4, '3:4', 'black', false, true, false, '[{"sku":"body-navidad-acebo","qty":1}]', 'Rojo y verde, con acebo, bayas y bolas en las esquinas del marco.', 12, '{"top":2.4,"right":2.4,"bottom":2.4,"left":2.4}', 'navidad', 'traditional'),
  ('estrellas-oro', 'Estrellas de Oro', '15×20 cm', 'basic', 'Navidad', 7900, 15, 20, 19.6, 25.2, 2.3, '3:4', 'gold', false, true, false, '[{"sku":"body-navidad-oro","qty":1}]', 'Crema y oro, con estrellas y una guirnalda pintada en el borde.', 13, '{"top":2.6,"right":2.3,"bottom":2.6,"left":2.3}', 'navidad', 'traditional'),
  ('retablo-ayacucho', 'Retablo de Ayacucho', '15×20 cm', 'basic', 'Navidad', 7900, 15, 20, 20.2, 26.6, 2.6, '3:4', 'wood', false, true, false, '[{"sku":"body-navidad-retablo","qty":1}]', 'Borde pintado como un retablo ayacuchano: sol, cerros y figuras. La foto queda limpia.', 14, '{"top":2.4,"right":2.6,"bottom":4.2,"left":2.6}', 'navidad', 'peruvian'),
  ('aguayo-andino', 'Aguayo Andino', '15×20 cm', 'basic', 'Navidad', 7900, 15, 20, 20, 25.8, 2.5, '3:4', 'wood', false, true, false, '[{"sku":"body-navidad-aguayo","qty":1}]', 'Tejido andino, franjas rojas y blancas, y una llama en el borde de abajo.', 15, '{"top":2.4,"right":2.5,"bottom":3.4,"left":2.5}', 'navidad', 'peruvian'),
  ('noche-nevada', 'Noche Nevada', '15×20 cm', 'basic', 'Navidad', 7900, 15, 20, 19.4, 25.8, 2.2, '3:4', 'black', false, true, false, '[{"sku":"body-navidad-noche","qty":1}]', 'Azul noche, copos de nieve y un trineo chico en el borde de abajo.', 16, '{"top":2.2,"right":2.2,"bottom":3.6,"left":2.2}', 'navidad', 'traditional'),
  ('pino-rustico', 'Pino Rústico', '15×20 cm', 'basic', 'Navidad', 7900, 15, 20, 19.8, 25.6, 2.4, '3:4', 'wood', false, true, false, '[{"sku":"body-navidad-pino","qty":1}]', 'Kraft y ramas de pino, con luces pintadas dentro del marco.', 17, '{"top":2.4,"right":2.4,"bottom":3.2,"left":2.4}', 'navidad', 'traditional')
on conflict (id) do nothing;
