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
| `EXPO_PUBLIC_SITE_URL` | cliente | origen público, sin barra final |
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

1. Crea un proyecto en supabase.com.
2. En el SQL editor corre `supabase/migrations/20261118120000_init.sql` y luego `supabase/seed.sql`.
3. Authentication → añade un usuario y copia su `id`.
4. `insert into public.admin_users (user_id, email) values ('…', 'tu@correo');`
5. Storage: el bucket `photos` lo crea la migración. En Settings → CORS permite tu dominio si vas a descargar la impresión desde el admin.
6. En `.env`: `EXPO_PUBLIC_DATA_MODE=supabase` más la URL y la anon key.

El modo `local` no necesita esto. Con `supabase`, el admin entra con Auth y la tienda sigue usando el motor de precios del cliente después de comprobar que el proyecto responde. El webhook de WhatsApp, si tiene `SUPABASE_SERVICE_ROLE_KEY`, guarda cada sesión en `wa_events`.

`app_settings.payments_mode` nace en `mock`. Pásalo a `live` antes de cobrar de verdad para que un cliente no pueda marcar un pedido como pagado por su cuenta cuando cierres esa puerta en el servidor.

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

## Publicar la web

```bash
npm run build:web
```

Eso deja un sitio estático en `dist/`.

Vercel: el `vercel.json` ya publica `dist` y deja pasar `/api/*` a las funciones. Netlify: `netlify.toml` publica `dist` y reescribe el resto a `index.html`.

En ambos, define las variables de servidor en el panel. No marques como públicas el token de Mercado Pago, el de WhatsApp ni la service role.

## iOS y Android

El proyecto es Expo SDK 58 con Expo Router. `npx expo start` y Expo Go abren la misma navegación. El selector de fotos en el teléfono usa la librería del sistema (en iPhone, Fotos / iCloud, incluido HEIC). La descarga del archivo de imprenta está hecha para la web.
