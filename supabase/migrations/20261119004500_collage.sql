-- Collage de fotos. No aplicar en producción hasta revisar el pedido:
-- el ítem guarda el JPEG de imprenta y este JSON con las fotos fuente y el diseño.
alter table public.order_items add column if not exists collage jsonb;

comment on column public.order_items.collage is
  'Diseño del collage: plantilla, fotos fuente, recortes, fondo y leyenda.';
