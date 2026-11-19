-- Printed gift note for every order. Not applied to the live project yet.
-- Existing row policies on public.orders already cover these columns:
-- "admin all orders", "customer reads own orders", and
-- "customer reads own orders by user". No new grant for anon.

alter table public.orders
  add column if not exists gift_note_to text,
  add column if not exists gift_note_message text,
  add column if not exists gift_note_from text,
  add column if not exists hide_prices boolean not null default false,
  add column if not exists gift_note_cents integer not null default 0;

alter table public.orders drop constraint if exists orders_gift_note_to_len;
alter table public.orders
  add constraint orders_gift_note_to_len check (gift_note_to is null or char_length(gift_note_to) <= 60);

alter table public.orders drop constraint if exists orders_gift_note_from_len;
alter table public.orders
  add constraint orders_gift_note_from_len check (gift_note_from is null or char_length(gift_note_from) <= 60);

alter table public.orders drop constraint if exists orders_gift_note_message_len;
alter table public.orders
  add constraint orders_gift_note_message_len check (gift_note_message is null or char_length(gift_note_message) <= 250);

alter table public.orders drop constraint if exists orders_gift_note_cents_nonneg;
alter table public.orders
  add constraint orders_gift_note_cents_nonneg check (gift_note_cents >= 0);

comment on column public.orders.gift_note_message is 'Printed gift note, up to 250 characters. Free unless gift_note_cents says otherwise.';
comment on column public.orders.hide_prices is 'Packer omits prices from the box. There is no packing-slip file yet.';
