-- Reconcile live Mi Fotito with the app code. Idempotent.
create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$ select private.is_admin(); $$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'customers' and column_name = 'user_id') then
    alter table public.customers rename column user_id to auth_user_id;
  end if;
end $$;
drop policy if exists "customer reads own row" on public.customers;

alter table public.orders alter column number drop default;
create or replace function private.set_order_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.number is null or new.number = '' then
    new.number := public.next_order_number();
  end if;
  return new;
end;
$$;
drop trigger if exists orders_set_number on public.orders;
create trigger orders_set_number before insert on public.orders
for each row execute function private.set_order_number();

drop policy if exists "customer reads own profile" on public.customers;
create policy "customer reads own profile" on public.customers
  for select to authenticated using (auth_user_id = (select auth.uid()));
drop policy if exists "customer updates own profile" on public.customers;
create policy "customer updates own profile" on public.customers
  for update to authenticated using (auth_user_id = (select auth.uid())) with check (auth_user_id = (select auth.uid()));

drop policy if exists "customer reads own addresses" on public.customer_addresses;
create policy "customer reads own addresses" on public.customer_addresses
  for select to authenticated using (customer_id in (select id from public.customers where auth_user_id = (select auth.uid())));
drop policy if exists "customer inserts own addresses" on public.customer_addresses;
create policy "customer inserts own addresses" on public.customer_addresses
  for insert to authenticated with check (customer_id in (select id from public.customers where auth_user_id = (select auth.uid())));
drop policy if exists "customer updates own addresses" on public.customer_addresses;
create policy "customer updates own addresses" on public.customer_addresses
  for update to authenticated
  using (customer_id in (select id from public.customers where auth_user_id = (select auth.uid())))
  with check (customer_id in (select id from public.customers where auth_user_id = (select auth.uid())));
drop policy if exists "customer deletes own addresses" on public.customer_addresses;
create policy "customer deletes own addresses" on public.customer_addresses
  for delete to authenticated using (customer_id in (select id from public.customers where auth_user_id = (select auth.uid())));

drop policy if exists "customer reads own orders" on public.orders;
create policy "customer reads own orders" on public.orders
  for select to authenticated using (customer_id in (select id from public.customers where auth_user_id = (select auth.uid())));
drop policy if exists "customer reads own items" on public.order_items;
create policy "customer reads own items" on public.order_items
  for select to authenticated using (order_id in (
    select id from public.orders where customer_id in (select id from public.customers where auth_user_id = (select auth.uid()))));

create index if not exists customer_addresses_customer_id_idx on public.customer_addresses(customer_id);

drop policy if exists "public can open a voice note" on public.voice_notes;
create policy "admin reads voice notes" on public.voice_notes
  for select to authenticated using ((select private.is_admin()));

update storage.buckets
set public = false,
    file_size_limit = 26214400,
    allowed_mime_types = array['image/*', 'audio/*', 'application/pdf']
where id = 'photos';
