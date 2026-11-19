-- Gift flag for every order. Not applied to the live project yet.
-- Existing row policies on public.orders already cover this column.

alter table public.orders
  add column if not exists is_gift boolean not null default false;

comment on column public.orders.is_gift is 'Buyer marked the order as a gift. The printed note, if any, stays in gift_note_message.';
