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

## Arranque local

```bash
npm install
npm test
npm run web
```

Abre http://localhost:8081. Sin variables, los datos viven en el navegador (semilla incluida). Admin de la demo:

- correo `admin@mifotito.pe`
- contraseña `recuerdo-demo`

Códigos de prueba: `NAVIDAD10` (10%), `MARCO20` (S/ 20), gift card `HOLANAVIDAD` (S/ 50), referido `AMIGO1500`. El pedido de ejemplo está en `/pedido/demo-lima` con el celular `987 654 321`.

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
| `EXPO_PUBLIC_WHATSAPP_SUPPORT_NUMBER` | cliente | botón de soporte, formato `51999…` |
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
| `WHATSAPP_TOKEN` | servidor | token de Cloud API |
| `WHATSAPP_PHONE_NUMBER_ID` | servidor | id del número de WhatsApp |
| `WHATSAPP_VERIFY_TOKEN` | servidor | el que pones en el webhook de Meta |
| `WHATSAPP_GRAPH_VERSION` | servidor | por defecto `v21.0` |
| `RESEND_API_KEY` | servidor | correo opcional |
| `EMAIL_FROM` | servidor | remitente |
| `META_APP_ID` / `META_APP_SECRET` | servidor | OAuth de Instagram y Facebook |
| `GOOGLE_PHOTOS_CLIENT_ID` / `GOOGLE_PHOTOS_CLIENT_SECRET` | servidor | OAuth de Google Photos |
| `SITE_URL` | servidor | igual que el sitio público |

Izipay (tarjeta y Yape) queda como siguiente proveedor. Las variables están comentadas en `.env.example` y todavía no se usan. Hoy el modo live manda tarjeta y Yape a Mercado Pago, y Plin devuelve el número del comercio.

## Supabase

El proyecto en vivo es `mifotito` (`tvochainkffolgvcnucs`, Sao Paulo): `https://tvochainkffolgvcnucs.supabase.co`.

Ya están aplicadas, y no hay que volver a correrlas:

1. `supabase/migrations/20261118182440_init.sql` (en Supabase figura como versión `20261118182440`)
2. `supabase/migrations/20261118182536_customers_order_numbers_hardening.sql`

Falta aplicar, en el SQL editor, solo este archivo nuevo:

3. `supabase/migrations/20261118193000_shop_extras.sql`

Ese archivo agrega los marcos de Navidad, el stock, las columnas de texto/tarjeta/voz, las direcciones, los códigos de WhatsApp, las consultas de retablo y las notas de voz. Sin él, un marco de los diez originales se puede pedir; una tarjeta, un marco de Navidad o el audio del QR todavía no.

El admin entra con Supabase Auth. Después del primer ingreso, Lucas agrega su fila:

```sql
insert into public.admin_users (user_id, email) values ('uuid-del-usuario', 'tu@correo');
```

Sin `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY` la tienda sigue en modo local (demo en el navegador). Con las dos, marcos, reseñas y la campaña activa se leen con la clave anon. Los pedidos los escriben las funciones de Netlify con `SUPABASE_SERVICE_ROLE_KEY`.

El número `MF-26-####` lo asigna la base. Lo ve el admin. El cliente no: rastrea con el celular y el código de WhatsApp, y el enlace usa el token público.

## Pagos

En `mock`, Yape, Plin y tarjeta abren una hoja de sandbox y el pedido queda pagado. En `live`, la web llama `POST /api/payments/create`. Tarjeta y Yape crean una preferencia de Mercado Pago. Plin responde con el celular de `PLIN_PHONE` para confirmar a mano.

## WhatsApp

El cliente puede mandar una foto al número de WhatsApp Business.

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

Instagram, Facebook y Google Photos no se muestran hasta que el flag esté en `true` y exista el id público. Los secretos (`META_APP_SECRET`, `GOOGLE_PHOTOS_CLIENT_SECRET`) se quedan en el servidor.

Para Google Photos hace falta el Picker API (`photospicker.googleapis.com`) y el scope `photospicker.mediaitems.readonly`: activa la API en Google Cloud, crea un cliente OAuth web y autoriza el redirect del dominio. Meta pide revisión de `instagram_business_basic` o `user_photos` antes de que alguien fuera de los testers vea sus fotos. Hasta esa aprobación, déjalos apagados. El enlace de OAuth y la descarga en alta de esas dos redes es el siguiente paso; el selector del teléfono ya está listo.

## Campaña

`data/campaign.json` es Navidad 2026. Lima hasta el 18 de diciembre 23:59 y provincias hasta el 15, hora de Lima. Después de la fecha el texto avisa que puede llegar tarde y apunta a San Valentín (14 de febrero). El reloj de cuenta regresiva (inicio y checkout) sigue en el código, pero no se muestra hasta `countdownStartsAt` (10 de diciembre de 2026, 00:00, hora de Lima). `EXPO_PUBLIC_COUNTDOWN=true` lo enciende antes y `false` lo apaga aunque ya haya pasado esa fecha. Para cambiar de campaña, sustituye ese JSON por `data/campaign-san-valentin.json` o actualiza la fila activa en `campaigns`.

Los días de entrega están en `src/lib/delivery.ts`: Lima 2–3 días hábiles, provincias 3–5, con feriados.

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

`netlify.toml` redirige `www` y `http` a `https://mifotito.com`, manda `/api/payments/create`, `/api/notify` y `/api/webhooks/whatsapp` a las funciones, y el resto de rutas del cliente a `/index.html`. Los archivos con hash en `/_expo/static/` y `/assets/` se cachean un año. `index.html` no.

### Variables en Netlify

No hace falta ninguna para el demo. Para cobrar y escribir de verdad, en Site configuration → Environment variables:

| Variable | Para qué |
| --- | --- |
| `EXPO_PUBLIC_SITE_URL` | `https://mifotito.com` (el toml ya la pone en el build) |
| `EXPO_PUBLIC_DATA_MODE` | `supabase` |
| `EXPO_PUBLIC_SUPABASE_URL` | `https://tvochainkffolgvcnucs.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | clave anon. Pública en el bundle, nunca la service role |
| `EXPO_PUBLIC_PAYMENTS_MODE` | `live` |
| `EXPO_PUBLIC_NOTIFY_MODE` | `live` |
| `EXPO_PUBLIC_WHATSAPP_SUPPORT_NUMBER` | celular de soporte, `51999…` |
| `SUPABASE_URL` | `https://tvochainkffolgvcnucs.supabase.co`, solo en el servidor |
| `SUPABASE_SERVICE_ROLE_KEY` | funciones de Netlify: pedidos, fotos firmadas, códigos. Nunca en el cliente ni con prefijo `EXPO_PUBLIC_` |
| `OTP_SIGNING_SECRET` | firma la sesión de 30 minutos tras el código de WhatsApp |
| `WHATSAPP_OTP_ENABLED` | `false` hasta que Meta apruebe la plantilla. En `true` el código sale por WhatsApp y no vuelve en la respuesta |
| `WHATSAPP_OTP_TEMPLATE` | plantilla de autenticación. Por defecto `mifotito_codigo` |
| `WHATSAPP_OTP_TEMPLATE_LANG` | `es` |
| `PAYMENTS_MODE` | `live` |
| `MERCADOPAGO_ACCESS_TOKEN` | tarjeta y Yape |
| `PLIN_PHONE` | número Plin del comercio |
| `YAPE_PHONE` | referencia Yape |
| `WHATSAPP_TOKEN` | Cloud API |
| `WHATSAPP_PHONE_NUMBER_ID` | id del número |
| `WHATSAPP_VERIFY_TOKEN` | verificación del webhook de Meta |
| `SITE_URL` | `https://mifotito.com` |

Las que empiezan con `EXPO_PUBLIC_` quedan dentro del JavaScript. No pongas ahí el token de Mercado Pago, el de WhatsApp ni la service role.

El webhook de Meta es `https://mifotito.com/api/webhooks/whatsapp`.

## Dónde vive cada dato

Sin `EXPO_PUBLIC_DATA_MODE=supabase` todo sigue en el navegador (demo). Con Supabase, lo compartido pasa al proyecto:

| Dato | Dónde |
| --- | --- |
| Pedidos y líneas | Postgres `orders` / `order_items`. La base asigna `MF-26-####` y el `public_token`. La función `create-order` devuelve solo el token |
| Fotos y audio | Bucket privado `photos`, un archivo por subida: `uploads/<uuid>.<ext>`. El visitante solo puede insertar. El admin abre una URL firmada |
| Clientes | `customers` (teléfono único, nombre, correo, `user_id`). Direcciones en `customer_addresses` después de la migración nueva |
| Stock, promos, gift cards, referidos, créditos | Tablas del servidor. El mostrador lee cantidades con `public_stock()` |
| Reclamos y consultas de retablo | `claims`, `retablo_inquiries` |
| Mensaje de voz | `voice_notes` + el mismo bucket, bajo `uploads/` |
| Código de WhatsApp | Hash en `phone_otps` (10 min, 5 intentos, límite por teléfono e IP). El envío real espera `WHATSAPP_OTP_ENABLED=true` |
| Carrito y recibo de la pestaña | Siguen en el navegador hasta pagar |

El cliente no ve el número `MF-…`. Rastrea con el celular y el código, y abre `/pedido/<token>`.

### Checklist de Supabase

1. El proyecto `mifotito` ya existe. No vuelvas a correr `20261118182440` ni `20261118182536`.
2. SQL editor: corre solo `supabase/migrations/20261118193000_shop_extras.sql`.
3. Authentication → Providers: Email activo. Site URL `https://mifotito.com` y redirect `https://mifotito.com/**`.
4. Storage: el bucket `photos` es privado, 25 MB, imágenes y audio. No lo hagas público.
5. Authentication → Users: crea el admin e inserta su UUID en `admin_users`.
6. WhatsApp Manager: plantilla de autenticación `mifotito_codigo`, idioma español. Déjala en espera y mantén `WHATSAPP_OTP_ENABLED=false` hasta que Meta la apruebe. Mientras tanto la función devuelve el código en la respuesta.
7. En Netlify, Site configuration → Environment variables:

| Variable | Valor |
| --- | --- |
| `EXPO_PUBLIC_DATA_MODE` | `supabase` |
| `EXPO_PUBLIC_SUPABASE_URL` | `https://tvochainkffolgvcnucs.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | clave anon del proyecto |
| `EXPO_PUBLIC_SITE_URL` | `https://mifotito.com` |
| `SUPABASE_URL` | `https://tvochainkffolgvcnucs.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | service role. Solo servidor |
| `OTP_SIGNING_SECRET` | secreto largo para la sesión del celular |
| `WHATSAPP_OTP_ENABLED` | `false` hasta que la plantilla esté aprobada |
| `WHATSAPP_TOKEN` | Cloud API, cuando exista |
| `WHATSAPP_PHONE_NUMBER_ID` | id del número |
| `WHATSAPP_OTP_TEMPLATE` | `mifotito_codigo` |
| `WHATSAPP_OTP_TEMPLATE_LANG` | `es` |

No pongas la service role, el token de WhatsApp ni el de Mercado Pago en una variable `EXPO_PUBLIC_`. Sin las claves de Supabase el sitio publicado sigue en modo demo y muestra el aviso rojo.

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
