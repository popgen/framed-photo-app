-- Donación opcional de S/ 5.00 y producto de prueba (sin marco).
-- Aplicar en el SQL editor antes de cobrar donaciones o el producto de prueba.

alter table public.orders
  add column if not exists donation_cents integer not null default 0;

alter table public.orders
  drop constraint if exists orders_donation_cents_check;

alter table public.orders
  add constraint orders_donation_cents_check check (donation_cents in (0, 500));

comment on column public.orders.donation_cents is
  'Donación opcional en céntimos. Solo 0 o 500. No la reducen los descuentos ni el saldo.';

alter table public.order_items
  add column if not exists test_product boolean not null default false;

alter table public.order_items
  drop constraint if exists order_items_frame_id_fkey;

alter table public.order_items
  alter column frame_id drop not null;

alter table public.order_items
  drop constraint if exists order_items_frame_or_test;

alter table public.order_items
  add constraint order_items_frame_or_test check (
    (test_product = true and frame_id is null)
    or (test_product = false and frame_id is not null)
  );

comment on column public.order_items.test_product is
  'Producto de prueba de S/ 5.00. No es un marco y no entra a producción.';
