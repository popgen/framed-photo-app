-- Printed Christmas border ("Marco navideño impreso") chosen for a framed photo.
-- It is drawn on the photo itself, not a physical frame. Null means "Sin borde".
alter table public.order_items add column if not exists print_border text;
comment on column public.order_items.print_border is 'Printed Christmas border id (acebo, guirnalda, copos, baston, estrella, andino) baked into the print; null = none.';
