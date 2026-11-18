-- DNI or RUC collected at checkout. Nullable so orders placed before this column stay valid.
-- The app and the create-order function reject a new order without a valid value.

alter table public.orders add column if not exists tax_id text;
alter table public.orders add column if not exists tax_id_type text;

alter table public.orders drop constraint if exists orders_tax_id_type_check;
alter table public.orders
  add constraint orders_tax_id_type_check
  check (tax_id_type is null or tax_id_type in ('DNI', 'RUC'));
