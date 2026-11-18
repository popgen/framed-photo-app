-- Not applied. Live /api/shop?op=frames currently returns the 10 classic frames and omits category.
-- This sets category and style from the app catalog and inserts the 7 Christmas frames if the seed never added them.

insert into public.frames (id, name, size_label, tier, tier_label, price_cents, print_w_cm, print_h_cm, outer_w_cm, outer_h_cm, moulding_cm, aspect, material, mat, stand, hanging, consumes, blurb, sort, border, category, style) values
  ('nieve-celeste', 'Nieve Celeste', '15×20 cm', 'basic', 'Navidad', 7900, 15, 20, 19.4, 26, 2.2, '3:4', 'white', false, true, false, '[{"sku":"body-navidad-nieve","qty":1}]', 'Celeste claro, con nieve, muñeco y arbolito en el marco. El borde de abajo es más alto.', 11, '{"top":2.2,"right":2.2,"bottom":3.8,"left":2.2}', 'navidad', 'traditional'),
  ('acebo-clasico', 'Acebo Clásico', '15×20 cm', 'basic', 'Navidad', 7900, 15, 20, 19.8, 24.8, 2.4, '3:4', 'black', false, true, false, '[{"sku":"body-navidad-acebo","qty":1}]', 'Rojo y verde, con acebo, bayas y bolas en las esquinas del marco.', 12, '{"top":2.4,"right":2.4,"bottom":2.4,"left":2.4}', 'navidad', 'traditional'),
  ('estrellas-oro', 'Estrellas de Oro', '15×20 cm', 'basic', 'Navidad', 7900, 15, 20, 19.6, 25.2, 2.3, '3:4', 'gold', false, true, false, '[{"sku":"body-navidad-oro","qty":1}]', 'Crema y oro, con estrellas y una guirnalda pintada en el borde.', 13, '{"top":2.6,"right":2.3,"bottom":2.6,"left":2.3}', 'navidad', 'traditional'),
  ('retablo-ayacucho', 'Retablo de Ayacucho', '15×20 cm', 'basic', 'Navidad', 7900, 15, 20, 20.2, 26.6, 2.6, '3:4', 'wood', false, true, false, '[{"sku":"body-navidad-retablo","qty":1}]', 'Borde pintado como un retablo ayacuchano: sol, cerros y figuras. La foto queda limpia.', 14, '{"top":2.4,"right":2.6,"bottom":4.2,"left":2.6}', 'navidad', 'peruvian'),
  ('aguayo-andino', 'Aguayo Andino', '15×20 cm', 'basic', 'Navidad', 7900, 15, 20, 20, 25.8, 2.5, '3:4', 'wood', false, true, false, '[{"sku":"body-navidad-aguayo","qty":1}]', 'Tejido andino, franjas rojas y blancas, y una llama en el borde de abajo.', 15, '{"top":2.4,"right":2.5,"bottom":3.4,"left":2.5}', 'navidad', 'peruvian'),
  ('noche-nevada', 'Noche Nevada', '15×20 cm', 'basic', 'Navidad', 7900, 15, 20, 19.4, 25.8, 2.2, '3:4', 'black', false, true, false, '[{"sku":"body-navidad-noche","qty":1}]', 'Azul noche, copos de nieve y un trineo chico en el borde de abajo.', 16, '{"top":2.2,"right":2.2,"bottom":3.6,"left":2.2}', 'navidad', 'traditional'),
  ('pino-rustico', 'Pino Rústico', '15×20 cm', 'basic', 'Navidad', 7900, 15, 20, 19.8, 25.6, 2.4, '3:4', 'wood', false, true, false, '[{"sku":"body-navidad-pino","qty":1}]', 'Kraft y ramas de pino, con luces pintadas dentro del marco.', 17, '{"top":2.4,"right":2.4,"bottom":3.2,"left":2.4}', 'navidad', 'traditional')
on conflict (id) do update set
  category = excluded.category,
  style = excluded.style,
  border = excluded.border,
  tier_label = excluded.tier_label;

update public.frames set style = 'traditional' where id in ('thin-black-15', 'thin-white-15', 'wood-15', 'thin-gold-15', 'black-30', 'white-30', 'wood-30', 'black-mat', 'wood-mat', 'square-black-20') and style is null;
