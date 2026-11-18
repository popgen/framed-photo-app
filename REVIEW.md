# Revisión de Mi Fotito — 18 de noviembre de 2026

Qué se revisó: todo `src/`, `api/`, `netlify/`, `supabase/`, la configuración de
build y el despliegue. `npm test` (80 pruebas), `npm run typecheck` y
`npm run build:web` pasan.

Lo que sigue está ordenado por lo que cuesta dinero primero.

---

## 1. Crítico — hay que arreglarlo antes de cobrar de verdad

### 1.1 Cualquiera puede marcar un pedido como pagado

`api/shop.mjs` → `markPaid()` (línea ~554). No comprueba sesión, ni que el
pedido sea de quien llama, ni que el pago haya pasado por una pasarela.

```bash
curl -X POST https://mifotito.com/api/shop?op=orders-mark-paid \
  -H 'content-type: application/json' \
  -d '{"orderId":"<el id del pedido>","method":"yape","provider":"izipay"}'
```

Eso marca el pedido `paid`, descuenta stock, gasta el código de promoción y lo
manda a producción. Quien hace un pedido conoce su propio `orderId`: el checkout
se lo devuelve. O sea que cualquier cliente puede pedir un marco gratis.

El README dice que `app_settings.payments_mode` cierra esa puerta en el servidor,
pero **esa comprobación no existe en el código**. `payments_mode` solo se lee en
el cliente (`src/lib/env.ts`), donde no protege nada.

Cómo arreglarlo:

- En modo `live`, `markPaid` solo debería aceptar llamadas internas: hoy la única
  legítima es `confirmIzipay()`, que ya verifica el HMAC y el monto. Un
  `op: "orders-mark-paid"` que llega por HTTP debería rechazarse.
- Dejar el camino del cliente solo para modo `mock`, y leer el modo del servidor
  (`PAYMENTS_MODE`), no del cliente.
- Para pedidos de total 0 (gift card que cubre todo), hacer la confirmación en el
  servidor dentro de `createOrder`, con el total que calculó el servidor.

### 1.2 Cualquiera puede crear una tarjeta de regalo con el saldo que quiera

`api/shop.mjs` → `giftCard()` (línea ~767). Sin sesión y sin validar el monto.

```bash
curl -X POST https://mifotito.com/api/shop?op=gift-card \
  -H 'content-type: application/json' \
  -d '{"amountCents":9999900,"buyerName":"x","buyerPhone":"987654321"}'
```

Devuelve un código activo con S/ 99 999 de saldo, y ese código se aplica en el
checkout. Es dinero gratis.

Cómo arreglarlo: exigir sesión de admin (`adminSession`), igual que
`customers-list`. Si en algún momento el cliente compra gift cards, el saldo lo
tiene que fijar el servidor tras confirmar el pago, nunca el cuerpo del pedido.

### 1.3 `/api/notify` manda WhatsApp a cualquier número

`api/notify.mjs` acepta `to` y `body` sin autenticación. Hoy no hace daño porque
`WHATSAPP_TOKEN` está vacío, pero el día que se active la Cloud API se vuelve un
relay de spam abierto, a cargo de la cuenta de Mi Fotito, y con riesgo de que
Meta bloquee el número.

Cómo arreglarlo: autenticar (admin o un secreto compartido entre funciones), y
limitar por IP. Lo mismo aplica a `op: "voice-selfie"`, que deja sobrescribir el
nombre y la selfie de cualquier nota de voz si se conoce el token.

### 1.4 Mercado Pago nunca confirma el pago

Si Izipay no está configurado, `api/payments/create.mjs` crea una preferencia de
Mercado Pago y manda a la persona a `checkoutUrl`. No hay webhook ni ruta de
retorno para Mercado Pago. La persona paga, vuelve, y el pedido sigue en
`pending_payment` para siempre.

Hoy eso queda tapado por 1.1 (el cliente marca el pedido pagado por su cuenta),
así que arreglar 1.1 sin arreglar esto deja a Mercado Pago sin funcionar.

Cómo arreglarlo: o un webhook `/api/payments/mercadopago-ipn` que verifique el
pago contra la API de Mercado Pago antes de confirmar, o quedarse solo con
Izipay y quitar el camino de Mercado Pago.

---

## 2. Importante

### 2.1 Redirección abierta en las rutas de pago e importación

`api/payments/izipay-confirm.mjs` → `returnOrigin()` y
`api/imports/shared.mjs` → `siteOrigin()` sacan el origen del header `Origin` o
`Referer`, que los controla quien llama:

```bash
curl -X POST https://mifotito.com/api/payments/izipay-return \
  -H 'Origin: https://sitio-falso.com' -d 'kr-answer=x'
# → 303 https://sitio-falso.com/pago?error=1
```

Un enlace de Mi Fotito que termina en un sitio de phishing, con la marca de la
tienda detrás. Cómo arreglarlo: usar siempre `SITE_URL`, o validar el origen
contra una lista corta (`mifotito.com`, `www.mifotito.com`, los deploy previews).

### 2.2 El `<head>` del sitio en producción estaba vacío

`src/app/+html.tsx` no se usa: Expo solo lo aplica cuando `web.output` es
`"static"` o `"server"`, y `app.json` dice `"single"`. El `dist/index.html` que
se despliega salía con `lang="en"`, sin `description`, sin Open Graph y sin
`theme-color`.

Para un negocio donde el canal principal es WhatsApp, eso significa que un enlace
compartido no muestra ni título ni imagen.

**Ya está arreglado** en esta rama, con `scripts/finish-web-build.mjs`, que inyecta
el `<head>` después del export. Vale la pena evaluar pasar a `web.output: "static"`
más adelante: daría HTML real por ruta (mejor SEO) y haría innecesario el script.

### 2.3 El subidor de fotos está abierto

`supabase/migrations/…_hardening.sql`:

```sql
create policy "anon uploads" on storage.objects for insert to anon, authenticated
with check (bucket_id = 'photos' and name like 'uploads/%');
```

Cualquiera con la anon key (está en el JavaScript del sitio, como debe ser) puede
subir archivos de hasta 25 MB sin límite de cantidad. No se pueden leer de vuelta
(el bucket es privado), pero sí llenar el almacenamiento y la factura.

Cómo arreglarlo: subir a través de una función con URL firmada, o al menos un
límite por IP y una tarea que borre los `uploads/` sin pedido después de 24 h.

### 2.4 Falta la migración `orders.user_id`

`supabase/migrations/20261118210000_orders_user_id.sql` dice «Not applied».
Pero `createOrder` ya escribe `user_id`, y `orders-by-token`, `claim` y
«Mi cuenta» filtran por esa columna. Si no está aplicada en producción, los
pedidos fallan al insertarse y Mi cuenta sale vacía. Hay que correrla.

### 2.5 Código muerto que esconde bugs

- `api/shop.mjs` → `sendCode()` y `verifyCode()` responden y hacen `return` en la
  primera línea. Las ~50 líneas siguientes de cada una no se ejecutan nunca.
  Y `netlify/functions/otp-send.mjs` / `otp-verify.mjs` siguen desplegadas
  apuntando ahí.
- `markPaid()` tiene un bucle que no hace nada:
  ```js
  for (const item of order.items) { if (item.card || !item.frameId) continue; }
  ```
- `src/lib/phone-session.ts` y parte de `src/lib/otp.ts` ya no los usa la tienda.

Nada de esto se nota porque **`tsconfig.json` excluye `api/`, `netlify/`,
`scripts/` y `tests/`** del typecheck, y no hay ESLint en el proyecto. Las
funciones del servidor, que son las que manejan el dinero, son justo las que
nadie revisa automáticamente.

Recomendación: un segundo `tsconfig.server.json` que sí incluya `api/` y
`netlify/` con `allowJs`, y `eslint` con `no-unreachable` en el CI.

---

## 3. Lo que recomiendo cambiar (sin urgencia)

### Arquitectura

- **Dos fuentes de verdad para los precios.** `evaluateOrder` en el servidor y
  `quoteCheckout` en el cliente usan el mismo `src/lib/pricing.ts`, lo cual está
  muy bien. Pero `linePrice()` en `api/shop.mjs` vuelve a calcular el precio de la
  línea por su cuenta. Debería usar `quoteLines()` y no repetir la regla.
- **`repo-local.ts` tiene 900 líneas** y `repo-supabase.ts` hereda de él con
  `...local`. Funciona, pero cualquier método que se olviden de sobrescribir cae
  silenciosamente en el modo demo contra el navegador. Un tipo `Repository`
  explícito, sin spread, haría que TypeScript avise.
- **El admin escribe directo a Supabase** desde el cliente (`setStatus`,
  `setInventory`, `savePromo`). Depende solo de RLS. Las políticas están bien
  escritas, pero conviene que el cambio de estado de un pedido pase por una
  función, para dejar registro de quién lo hizo.

### Pruebas

80 pruebas, todas de lógica pura (precios, fechas, recortes). Es buena base. Lo
que no tiene prueba es justo lo caro:

- `evaluateOrder` con un carrito completo y un código de promoción
- `confirmIzipay` con firma buena, firma mala y monto que no coincide
- Que `markPaid` rechace a quien no debe (después del arreglo de 1.1)

### Contenido y datos

- `data/reviews.json` son reseñas de ejemplo. Si se muestran como reales en una
  tienda en vivo, es un problema legal además de un problema de confianza. O se
  reemplazan por reseñas reales, o se etiquetan.
- `EXPO_PUBLIC_WHATSAPP_SUPPORT_NUMBER` cae por defecto en `51999999999`, un
  número que no existe. Mejor esconder el botón si la variable falta.
- `assets/icon.png` pesa 384 KB para un ícono de 1024×1024. Pasarlo a WebP o
  recomprimirlo ahorra la mayor parte.

### Accesibilidad

- `Field` no enlaza la etiqueta con el `TextInput` (falta `accessibilityLabel`).
  Un lector de pantalla lee el campo sin saber qué pide.
- `Progress` tiene `accessibilityRole="progressbar"` pero no `accessibilityValue`.
- Varios textos grises (`colors.muted` sobre `colors.card`) quedan apenas por
  debajo del contraste 4.5:1 de WCAG AA.

---

## 4. Ideas de funciones

Ordenadas por lo que creo que devuelve más por el trabajo que cuesta.

**1. Vista previa en la pared con la cámara.** La duda más grande antes de comprar
un marco de 30×40 es «¿de qué tamaño se ve en mi sala?». Un botón que abra la
cámara y superponga el marco a escala resuelve eso. No hace falta ARCore:
pedir que apunten a la pared y ajustar con un deslizador ya ayuda muchísimo.
Es el único de la lista que probablemente suba la conversión de verdad.

**2. Recompra con un toque.** «Pídelo otra vez» en Mi cuenta, con la foto y el
marco ya puestos. El costo de traer de vuelta a quien ya compró es casi cero
comparado con el de conseguir a alguien nuevo.

**3. Recordatorios de fechas.** Guardar cumpleaños y aniversarios, y avisar por
WhatsApp dos semanas antes: «el cumple de mamá es el 3 de marzo, ¿le mandamos una
foto enmarcada?». Para un negocio de regalos esto convierte una compra al año en
tres o cuatro.

**4. Carrito abandonado.** Hay checkout, cuenta y WhatsApp. Falta el recordatorio
a las 2 y a las 24 horas. Suele recuperar entre el 10 % y el 20 %.

**5. Mejora de fotos antes de imprimir.** El aviso de «foto borrosa» ya existe,
pero solo avisa. Con un paso de nitidez y reducción de ruido del lado del
servidor, una foto de WhatsApp de 2014 imprime mucho mejor, y se puede cobrar
como extra.

**6. Más de una foto en un marco.** Collage de 2, 3 o 4 fotos dentro del mismo
marco. La lógica de `wall-slots.ts` ya hace algo muy parecido para el muro.

**7. PWA instalable.** Ya quedó listo en esta rama (manifest, íconos, accesos
directos). Falta un service worker para que cargue al instante en la segunda
visita y aguante una conexión mala, que en provincias es la norma.

**8. Seguimiento del envío de verdad.** Hoy `trackingNumber` es un texto suelto.
Conectar Olva o Shalom, aunque sea con un enlace que arme la URL del courier,
ahorra la mayoría de los mensajes de «¿dónde está mi pedido?».

**9. Estado del pedido con fotos.** Una foto del marco terminado antes de que
salga a reparto. Cuesta poco y da mucha confianza en una tienda nueva.

**10. Panel del admin con números.** Pedidos de hoy, ingresos de la semana,
marcos más vendidos. Hoy hay listas, pero no hay una pantalla que responda
«¿cómo vamos?».

---

## 5. Lo que está muy bien

Vale decirlo, porque hay decisiones buenas que conviene no deshacer:

- **La verificación de Izipay está bien hecha.** HMAC con comparación en tiempo
  constante, y el monto se compara contra el pedido guardado. Es exactamente como
  debe ser.
- **Las políticas RLS están pensadas.** `private.is_admin()` con `search_path`
  vacío, `(select auth.uid())` para que el planificador lo evalúe una vez, y
  `phone_otps` sin ninguna política (solo service role). Eso no es lo normal.
- **El enmascarado de datos en `/rastrear`** (nombre, dirección, celular) con
  límite por IP y por celular, es la decisión correcta para una consulta pública.
- **El motor de precios está aislado y probado.** Por eso el servidor puede
  recalcular el total sin confiar en el cliente.
- **El README es mejor que el de la mayoría de proyectos comerciales.**

---

## Resumen

| | |
| --- | --- |
| Arreglar antes de cobrar | 1.1 marcar pagado, 1.2 gift cards, 1.3 notify, 1.4 Mercado Pago |
| Arreglar pronto | 2.1 redirección abierta, 2.3 subidas abiertas, 2.4 migración pendiente |
| Ya arreglado aquí | 2.2 el `<head>` del sitio |
| Deuda técnica | typecheck que no cubre el servidor, código muerto, sin ESLint |
| La idea con más retorno | Vista previa en la pared con la cámara |
