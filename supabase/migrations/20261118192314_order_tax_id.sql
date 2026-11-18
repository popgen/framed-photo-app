-- DNI or RUC collected at checkout. tax_id stays nullable so older orders, and orders
-- where the buyer checked "no tengo", remain valid. tax_id_skipped records that choice.

alter table public.orders add column if not exists tax_id text;
alter table public.orders add column if not exists tax_id_type text;
alter table public.orders add column if not exists tax_id_skipped boolean not null default false;

alter table public.orders drop constraint if exists orders_tax_id_type_check;
alter table public.orders
  add constraint orders_tax_id_type_check
  check (tax_id_type is null or tax_id_type in ('DNI', 'RUC'));
