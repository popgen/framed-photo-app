# Mi Fotito

Tienda web para imprimir una foto y recibirla enmarcada en Perú. El cliente elige la foto, la ve dentro del marco, paga en soles y se la llevan a la casa. La interfaz está en español (Perú). La misma base de Expo sirve para web hoy y para iOS/Android después.

## Qué incluye

- Diez marcos con precio cerrado (envío incluido): Básico S/ 59, Muro S/ 109, Premium S/ 129.
- Recorte 3:4 o cuadrado, vertical u horizontal, y aviso de resolución (300 dpi ideal, se acepta desde ~150 dpi).
- Segundo marco al 20%. Desde el tercero, 15% en el set.
- Muro: trío, cuadrícula o mixto.
- Checkout de invitado, Lima vs provincias, otro destinatario, nota, envoltorio S/ 10 sin precios en la caja.
- Gift cards, promos y referidos.
- Campaña Navidad 2026 (se cambia por San Valentín 2027 en `data/campaign-san-valentin.json`).
- Pedido por WhatsApp: webhook de Cloud API y un sandbox en el admin cuando no hay credenciales.
- Admin con estados, revisión de foto borrosa, archivo de imprenta, guía, stock y reclamos.
- Política de privacidad en `/privacidad` y términos en `/terminos`. Las fotos del bucket privado se borran a los 30 días de entregado o cancelado el pedido.

## Arranque local

```bash
npm install
npm test
npm run web
```

Abre http://localhost:8081. Sin variables, los datos viven en el navegador (semilla incluida). Admin de la demo:

- correo `admin@mifotito.pe`
- contraseña `recuerdo-demo`

Códigos de prueba: `NAVIDAD10` (10%), `MARCO20` (S/ 20), gift card `HOLANAVIDAD` (S/ 50), referido `AMIGO1500`. El rastreo de un envío pendiente está en `/rastrear` y pide solo el celular.

Para repetir la demo, en el admin no hace falta: borra `localStorage` clave `recuerdo-db-v2`.

## Pruebas

```bash
npm test
npm run typecheck
```

Cubren precios, el corte de Navidad en hora de Lima, los pixeles de impresión, el stock compartido de los marcos con paspartú, los días hábiles y el flujo de WhatsApp.

## Variables

Copia `.env.example` a `.env`. No subas `.env`.

| Variable | Dónde | Para qué |
| --- | --- | --- |
| `EXPO_PUBLIC_DATA_MODE` | cliente | `local` (demo) o `supabase` |
| `EXPO_PUBLIC_SUPABASE_URL` | cliente | URL del proyecto |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | cliente | clave anon |
| `EXPO_PUBLIC_PAYMENTS_MODE` | cliente | `mock` o `live` |
| `EXPO_PUBLIC_NOTIFY_MODE` | cliente | `mock` o `live` |
| `EXPO_PUBLIC_SITE_URL` | cliente | origen público, sin barra final. Por defecto `https://mifotito.com` |
| `EXPO_PUBLIC_WHATSAPP_SUPPORT_NUMBER` | servidor | vacío. No pongas un número de relleno |
| `EXPO_PUBLIC_SEASONAL_MOTION` | cliente | `true` / `false`. Vacío usa la campaña |
| `EXPO_PUBLIC_COUNTDOWN` | cliente | `true` fuerza el reloj, `false` lo apaga. Vacío usa `countdownStartsAt` |
| `EXPO_PUBLIC_ENABLE_INSTAGRAM` | cliente | muestra Instagram solo con `EXPO_PUBLIC_META_APP_ID` |
| `EXPO_PUBLIC_ENABLE_FACEBOOK` | cliente | igual, con el app id de Meta |
| `EXPO_PUBLIC_ENABLE_GOOGLE_PHOTOS` | cliente | muestra Google Photos solo con el client id |
| `EXPO_PUBLIC_IMPORT_SANDBOX` | cliente | permite el botón sin credenciales reales |
| `EXPO_PUBLIC_META_APP_ID` | cliente | app id público de Meta |
| `EXPO_PUBLIC_GOOGLE_PHOTOS_CLIENT_ID` | cliente | client id de Google |
| `EXPO_PUBLIC_DEMO_ADMIN_EMAIL` | cliente | solo modo local |
| `EXPO_PUBLIC_DEMO_ADMIN_PASSWORD` | cliente | solo modo local |
| `SUPABASE_SERVICE_ROLE_KEY` | servidor | webhook y tareas admin |
| `PAYMENTS_MODE` | servidor | `mock` o `live` |
| `MERCADOPAGO_ACCESS_TOKEN` | servidor | Checkout Pro para tarjeta y Yape |
| `YAPE_PHONE` | servidor | referencia del comercio |
| `PLIN_PHONE` | servidor | número que se muestra al cliente |
| `WHATSAPP_TOKEN` | servidor | pendiente. Déjalo vacío; sin él no se llama a la Cloud API |
| `WHATSAPP_PHONE_NUMBER_ID` | servidor | pendiente, igual que el token |
| `WHATSAPP_VERIFY_TOKEN` | servidor | pendiente, para cuando se active el webhook |
| `WHATSAPP_GRAPH_VERSION` | servidor | por defecto `v21.0` |
| `RESEND_API_KEY` | servidor | correo opcional |
| `EMAIL_FROM` | servidor | remitente |
| `META_APP_ID` / `META_APP_SECRET` | servidor | OAuth de Instagram y Facebook |
| `GOOGLE_PHOTOS_CLIENT_ID` / `GOOGLE_PHOTOS_CLIENT_SECRET` | servidor | OAuth de Google Photos |
| `SITE_URL` | servidor | igual que el sitio público |

Izipay cobra tarjeta y Yape cuando `IZIPAY_COMMERCE_ID`, `IZIPAY_API_KEY`, `IZIPAY_PUBLIC_KEY` y `IZIPAY_HMAC_KEY` están puestos. Si faltan, el modo live sigue con Mercado Pago. Plin no pasa por Izipay.

## Supabase

1. Crea un proyecto en supabase.com.
2. En el SQL editor corre las migraciones de `supabase/migrations/` en orden de nombre, y luego `supabase/seed.sql`. `supabase/seed.demo.sql` es solo para la demo local.
3. Authentication → añade un usuario y copia su `id`.
4. `insert into public.admin_users (user_id, email) values ('…', 'tu@correo');`
5. Storage: el bucket `photos` lo crea la migración. En Settings → CORS permite tu dominio si vas a descargar la impresión desde el admin.
6. En `.env`: `EXPO_PUBLIC_DATA_MODE=supabase` más la URL y la anon key.

El modo `local` no necesita esto. Con `supabase`, el admin entra con Auth y la tienda sigue usando el motor de precios del cliente después de comprobar que el proyecto responde. El webhook de WhatsApp, si tiene `SUPABASE_SERVICE_ROLE_KEY`, guarda cada sesión en `wa_events`.

`app_settings.payments_mode` nace en `mock`. Pásalo a `live` antes de cobrar de verdad para que un cliente no pueda marcar un pedido como pagado por su cuenta cuando cierres esa puerta en el servidor.

## Stock

Las tablas `inventory` y el descuento al confirmar un pedido siguen en el código. Los avisos **Sin stock** y **Pocas unidades**, y el rechazo del pedido por falta de stock, están apagados mientras estas variables no sean `true`:

- `EXPO_PUBLIC_STOCK_CHECKS_ENABLED` (se hornea en el sitio; hay que volver a desplegar)
- `STOCK_CHECKS_ENABLED` (la leen las funciones de Netlify)

Si faltan o están vacías, el cliente puede elegir cualquier marco y el servidor no bloquea el pedido. El inventario igual se actualiza como registro, aunque la cantidad quede en cero o negativa. Para volver a controlar el stock, pon ambas en `true` y redespliega.

## Pagos

En `mock`, Yape, Plin y tarjeta abren una hoja de sandbox y el pedido queda pagado. En `live`, la web llama `POST /api/payments/create`. Si las cuatro claves de Izipay están, tarjeta y Yape abren su formulario (`/pago`) y el pedido se marca pagado solo cuando la firma HMAC del regreso o del IPN coincide y el monto es el del pedido. El IPN es `https://mifotito.com/api/payments/izipay-ipn`. Sin esas claves, tarjeta y Yape crean una preferencia de Mercado Pago. Plin responde con el celular de `PLIN_PHONE` para confirmar a mano.

## Pendiente: WhatsApp Business

Lucas deja para después la cuenta de WhatsApp Business. En Netlify quedan **sin valor** `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_OTP_TEMPLATE` y `WHATSAPP_OTP_TEMPLATE_LANG`.

Mientras falten:

- El cliente entra con correo y contraseña de Supabase Auth. Ya no hay código de 6 dígitos en la tienda. Rastrear un envío pendiente pide solo el celular. Mi cuenta muestra los pedidos de quien inició sesión.
- El webhook `/api/webhooks/whatsapp` y `/api/notify` no llaman a Graph. Escriben una advertencia en el log y responden 200. Un POST real, sin `mock: true`, responde «próximamente».
- El admin, en WhatsApp, muestra «Pedidos por el bot: próximamente» y un botón al chat. La vista previa local sigue ahí para probar el flujo sin Meta.
- La tienda no muestra WhatsApp. El contacto del cliente es pedidos@mifotito.com.

Cuando Meta apruebe la plantilla `mifotito_codigo`, se completan esas cuatro variables y `WHATSAPP_OTP_ENABLED=true`.

## WhatsApp

El cliente podrá mandar una foto al número de WhatsApp Business. Hoy ese bot está pendiente; los pasos de abajo quedan listos para cuando se active.

1. En Meta crea una app de WhatsApp, un número de prueba y un token permanente.
2. Webhook: `https://tu-dominio/api/webhooks/whatsapp`. Verificación: el `WHATSAPP_VERIFY_TOKEN`. Suscribe el campo `messages`.
3. Sin token, el handler no llama a Graph. Registra la respuesta y, si el id del media termina en `small`, simula una foto chica (700×900). Cualquier otra foto simulada usa 1772×2362, que es 300 dpi en 15×20.
4. Prueba local del sandbox dentro del admin → WhatsApp. Crea un pedido etiquetado WhatsApp y un enlace `/w/…` con la foto ya puesta.
5. Con credenciales, el webhook baja el binario a máxima resolución, mide ancho y alto, guarda el archivo y contesta con la lista de marcos, botones de muro / mismos marcos, el enlace mágico y Yape, Plin o tarjeta. «Hablar con alguien» marca el pedido para una persona.

Ejemplo sin credenciales:

```bash
curl -X POST http://localhost:3000/api/webhooks/whatsapp \
  -H 'content-type: application/json' \
  -d '{"mock":true,"from":"51987654321","width":1772,"height":2362}'
```

En Vercel esa ruta es la función `api/webhooks/whatsapp.mjs`. En el `npm run web` de Expo la función no está montada: usa el sandbox del admin o sirve `api/` con Vercel.

El flujo, en español: recibe la foto, avisa si no llega a 150 dpi y sugiere el tamaño menor, pide marco (lista con nombre y precio), confirma, y manda el enlace a la vista previa. Varias fotos ofrecen el muro.

## Importar fotos

En el teléfono, «Desde tu iPhone / iCloud» abre el selector del sistema. En Safari de iPhone eso incluye la fototeca de iCloud. HEIC se convierte a JPEG y, si la foto es enorme, se recorta al lado largo de la impresión (4724 px) antes de guardarla.

Instagram, Facebook y Google Photos no se muestran hasta que el flag esté en `true` y exista el id público. Los secretos (`META_APP_SECRET`, `GOOGLE_PHOTOS_CLIENT_SECRET`) se quedan en el servidor. El redirect de OAuth es `https://mifotito.com/api/imports/callback`.

Al tocar el botón, `/api/imports/start` manda a la red. Al volver, la sesión queda en una cookie httpOnly de 10 minutos y `/crear` lista las fotos. La descarga usa la imagen más grande: Facebook elige el `source` de mayor ancho, Instagram usa `media_url`, y Google Photos usa el Picker API (`photospicker.googleapis.com`, scope `photospicker.mediaitems.readonly`) con `=d` para el original. Meta sigue pidiendo revisión de `instagram_business_basic` o `user_photos` antes de que alguien fuera de los testers vea sus fotos. Hasta esa aprobación, déjalos apagados.

## Campaña

`data/campaign.json` es Navidad 2026. Lima hasta el 18 de diciembre 23:59 y provincias hasta el 15, hora de Lima. Después de la fecha el texto avisa que puede llegar tarde y apunta a San Valentín (14 de febrero). El reloj de cuenta regresiva (inicio y checkout) sigue en el código, pero no se muestra hasta `countdownStartsAt` (10 de diciembre de 2026, 00:00, hora de Lima). `EXPO_PUBLIC_COUNTDOWN=true` lo enciende antes y `false` lo apaga aunque ya haya pasado esa fecha. Para cambiar de campaña, sustituye ese JSON por `data/campaign-san-valentin.json` o actualiza la fila activa en `campaigns`.

Los días de entrega están en `src/lib/delivery.ts`: Lima 2–3 días hábiles, provincias 3–5, con feriados.

La tarjeta navideña se imprime en una sola hoja de impresora, en horizontal, y se dobla a la mitad. En A4 (297×210 mm) la tarjeta doblada es A5 vertical, 148×210 mm. En carta (11×8.5 pulgadas) queda de 5.5×8.5 pulgadas. La portada lleva una foto y el mensaje va en la mitad de adentro. El PDF tiene dos páginas del tamaño exacto de la hoja, para imprimir a doble cara, con la marca del doblez y las guías de corte. El reverso lleva la marca Mi Fotito. El sobre es uno, blanco, tamaño C5 (162×229 mm), que entra la A5. Los pedidos viejos en A6 o 5×7 siguen leyéndose con su tamaño guardado.

## Diseño móvil

La columna mide como máximo 480 px. Los botones pasan de 44 px, el CTA de crear, muro, carrito y pago queda fijo abajo, y el marco se cambia deslizando. Las fotos se redimensionan en el cliente al lado más largo de la impresión (4724 px) antes de guardarlas. `prefers-reduced-motion` apaga ornamentos, confeti y el contador animado del precio.

## Deploy

Producción es Netlify, en https://mifotito.com. El push a `main` lo despliega la integración de GitHub de Netlify. Los pull requests generan un Deploy Preview. El workflow `.github/workflows/ci.yml` corre `npm ci`, typecheck, tests y `npm run build:web`; no despliega.

El sitio funciona en modo demo sin ningún secreto: pagos sandbox, WhatsApp solo en el log, y los datos en el navegador.

### Ajustes del sitio en Netlify

- Repositorio: este repo de GitHub. Rama de producción: `main`.
- Build command: `npm run build:web`
- Publish directory: `dist`
- Node: `22` (ya está en `netlify.toml` como `NODE_VERSION`)
- Functions directory: `netlify/functions` (ya está en `netlify.toml`)
- Dominios: `mifotito.com` (primary) y `www.mifotito.com`

`netlify.toml` redirige `www` y `http` a `https://mifotito.com`. Cada función declara su ruta con `config.path` (`/api/shop`, `/api/track-orders`, `/api/payments/izipay-ipn`, `/api/imports/callback`, y las demás). No hay rewrites de `/api/*` hacia `/.netlify/functions/*`. El fallback a `/index.html` no lleva `force`, así que no tapa esas rutas. Los archivos con hash en `/_expo/static/` y `/assets/` se cachean un año. `index.html` no.

### Variables en Netlify

No hace falta ninguna para el demo. Para cobrar y escribir de verdad, en Site configuration → Environment variables:

| Variable | Para qué |
| --- | --- |
| `EXPO_PUBLIC_SITE_URL` | `https://mifotito.com` (el toml ya la pone en el build) |
| `EXPO_PUBLIC_DATA_MODE` | `supabase` |
| `EXPO_PUBLIC_SUPABASE_URL` | URL del proyecto |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | clave anon |
| `EXPO_PUBLIC_PAYMENTS_MODE` | `live` |
| `EXPO_PUBLIC_NOTIFY_MODE` | `live` |
| `EXPO_PUBLIC_WHATSAPP_SUPPORT_NUMBER` | déjalo vacío. Sin valor no se arma un enlace a un número falso |
| `SUPABASE_URL` | igual que la URL pública, solo en el servidor |
| `SUPABASE_SERVICE_ROLE_KEY` | funciones de Netlify: pedidos, fotos firmadas, códigos. Nunca en el cliente |
| `OTP_SIGNING_SECRET` | firma la sesión de 30 minutos tras confirmar el celular |
| `WHATSAPP_OTP_TEMPLATE` | pendiente. Vacío hasta que Meta apruebe `mifotito_codigo` |
| `WHATSAPP_OTP_TEMPLATE_LANG` | pendiente. Será `es` |
| `PAYMENTS_MODE` | `live` |
| `IZIPAY_COMMERCE_ID` | usuario REST de Izipay. Vacío: tarjeta y Yape siguen en Mercado Pago |
| `IZIPAY_API_KEY` | clave REST de Izipay. Solo en el servidor |
| `IZIPAY_PUBLIC_KEY` | clave pública del formulario |
| `IZIPAY_HMAC_KEY` | firma `kr-hash` del regreso y del IPN |
| `MERCADOPAGO_ACCESS_TOKEN` | tarjeta y Yape cuando Izipay no está configurado |
| `PLIN_PHONE` | número Plin del comercio |
| `YAPE_PHONE` | referencia Yape |
| `WHATSAPP_TOKEN` | pendiente. Vacío en Netlify por ahora |
| `WHATSAPP_PHONE_NUMBER_ID` | pendiente. Vacío en Netlify por ahora |
| `WHATSAPP_VERIFY_TOKEN` | verificación del webhook de Meta |
| `SITE_URL` | `https://mifotito.com` |

Las que empiezan con `EXPO_PUBLIC_` quedan dentro del JavaScript. No pongas ahí las claves de Izipay, el token de Mercado Pago, el de WhatsApp ni la service role.

El webhook de Meta es `https://mifotito.com/api/webhooks/whatsapp`.

## Dónde vive cada dato

Sin `EXPO_PUBLIC_DATA_MODE=supabase` todo sigue en el navegador (demo). Con Supabase, lo compartido pasa al proyecto:

| Dato | Dónde |
| --- | --- |
| Pedidos y líneas (marcos y tarjetas), número `MF-26-1004` | Postgres `orders` / `order_items`. El número sale de la secuencia `order_number_seq` (empieza en 1001) |
| Foto original y foto de imprenta | Bucket privado `photos`, rutas `uploads/<id>/original.jpg` y `print.jpg`. El admin las abre con URL firmada |
| Perfil: nombre, celular, correo, direcciones | `customers` y `customer_addresses`, ligados a `auth.users` por `auth_user_id`. El pedido web guarda `orders.user_id`. RLS: cada quien lee solo sus pedidos |
| Stock, promos, gift cards, referidos, créditos | Tablas `inventory`, `promo_codes`, `gift_cards`, `referrals`, `credits` |
| Reclamos y consultas de retablo | `claims`, `retablo_inquiries`. El pedido de retablo abre un correo a pedidos@mifotito.com, sin WhatsApp |
| Mensaje de voz | `voice_notes` + archivo en `photos/uploads/voice/<token>` |
| Código de WhatsApp | Solo el hash en `phone_otps` (10 min, 5 intentos) y los envíos en `otp_sends` |
| Carrito y recibo de la pestaña | Siguen en el navegador hasta pagar |

La política de privacidad está en https://mifotito.com/privacidad y los términos en https://mifotito.com/terminos. El export de Expo es una sola página, así que `npm run build:web` copia `public/privacidad` y `public/terminos` a `dist` para que esas dos direcciones respondan 200 y se lean sin JavaScript. Las fotos del bucket `photos` se borran dentro de los 30 días después de entregar o cancelar el pedido. Las subidas que no quedaron en un pedido se borran a los 30 días. El audio del QR no se borra, para que el mensaje siga abriendo. Eso lo hace la función programada `purge-photos` (Netlify, todos los días a las 08:00 UTC, solo en el deploy de producción). No hace falta una migración nueva.

En el checkout y en Mi cuenta la persona entra o crea una cuenta con correo y contraseña (mínimo 8 caracteres). «Olvidé mi contraseña» manda el enlace de Supabase. `/rastrear` no pide cuenta: con el celular (+51 y 9 dígitos) muestra solo envíos que no están entregados ni cancelados, y solo el número, el tipo (marco, muro o tarjeta), el estado y la fecha estimada. El nombre se ve como primer nombre e inicial. No salen dirección, foto, DNI/RUC ni pago. Esa consulta se limita por IP y por celular. `OTP_SIGNING_SECRET` ya no abre la sesión del cliente; puede quedar vacío. Sigue sirviendo, si está puesto, para la cookie de importación de fotos.

### Checklist de Supabase

1. Crea un proyecto en supabase.com.
2. Authentication → Providers: activa Email. Confirm email puede quedar encendido: el enlace abre `https://mifotito.com/cuenta` y el sitio reconoce la sesión. Si lo apagas, la cuenta queda lista al crearla, sin esperar el correo. No hace falta SMS. Site URL `https://mifotito.com`. Redirect URLs: `https://mifotito.com/**` y `https://mifotito.com/cuenta`. En Auth, si aparece el mínimo de contraseña, ponlo en 8.
3. SQL editor, en este orden (son las versiones que ya quedaron grabadas en el proyecto en vivo): `20261118182440_init.sql`, `20261118182536_customers_order_numbers_hardening.sql`, `20261118183011_cards_voice_retablo.sql`, `20261118183018_shared_backend.sql`, `20261118183109_reconcile_live_with_app.sql`, `20261118192312_voice_note_selfie.sql` (`selfie_path` y `sender_name` en `voice_notes`), `20261118192314_order_tax_id.sql` (`tax_id`, `tax_id_type` y `tax_id_skipped` en `orders`), `20261118210000_orders_user_id.sql` (`orders.user_id` y `track_lookups`), `20261118223000_frame_categories.sql` (categoría de cada marco) y `20261118233000_gift_note.sql` (nota impresa: `gift_note_to`, `gift_note_message`, `gift_note_from`, `hide_prices`, `gift_note_cents`) y `20261118234500_order_is_gift.sql` (`orders.is_gift`), luego `supabase/seed.sql`. No corras `supabase/seed.demo.sql` en producción. Las de usuario y categoría ya están aplicadas. La nota impresa y `is_gift` todavía no: córrelas en el SQL editor antes de usar el regalo en el proyecto en vivo.
4. Storage: el bucket privado `photos` lo crea la primera migración. No lo hagas público.
5. Authentication → Users: crea el admin y copia su UUID a `admin_users`.
6. WhatsApp Business queda pendiente. No hace falta crear la plantilla `mifotito_codigo` todavía. Cuando Meta la apruebe, el código de rastreo podrá salir por WhatsApp.
7. En Netlify, Environment variables: `EXPO_PUBLIC_DATA_MODE=supabase`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL` (la misma URL), `SUPABASE_SERVICE_ROLE_KEY`. `OTP_SIGNING_SECRET` puede quedar vacío: el cliente ya no lo usa. Deja sin valor `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_OTP_TEMPLATE` y `WHATSAPP_OTP_TEMPLATE_LANG`. La service role no lleva prefijo `EXPO_PUBLIC_`.

Sin esas variables de WhatsApp, el bot sigue en «próximamente». El modo demo (sin Supabase) crea la cuenta en el navegador, con la misma pantalla de correo y contraseña.

### DNS en Porkbun

En el dominio `mifotito.com`:

- Apex (`@`): registro **ALIAS** a `apex-loadbalancer.netlify.com`. Si Porkbun no ofrece ALIAS, un **A** a `75.2.60.5`.
- `www`: **CNAME** a `<sitio>.netlify.app` (el subdominio que Netlify muestra en Domain management, por ejemplo `mifotito.netlify.app`).

Quita otros A o CNAME que apunten el apex o `www` a otro lado. En Netlify, Domain management → Add domain → `mifotito.com`, y marca HTTPS.

### Verificar

1. `npm ci && npm test && npm run typecheck && npm run build:web` termina con `dist/index.html`.
2. El check de GitHub Actions en el PR está en verde.
3. Tras el merge a `main`, https://mifotito.com abre la tienda y https://www.mifotito.com redirige ahí.
4. Sin secretos, un pago de prueba en el sitio responde aprobado (sandbox). `POST /api/payments/create` con `{"orderId":"demo","amountCents":5900,"method":"yape"}` devuelve `"mock": true`.

## iOS y Android

El proyecto es Expo SDK 58 con Expo Router. `npx expo start` y Expo Go abren la misma navegación. El selector de fotos en el teléfono usa la librería del sistema (en iPhone, Fotos / iCloud, incluido HEIC). La descarga del archivo de imprenta está hecha para la web.
