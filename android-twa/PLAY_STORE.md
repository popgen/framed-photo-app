# Publicar Mi Fotito en Google Play

Pasos en orden. La parte técnica ya está hecha: el proyecto compila y firma.
Lo que falta es la cuenta, la llave y la ficha.

## 0. Antes de empezar

- [ ] `https://mifotito.com` abierto y con HTTPS válido
- [ ] Cuenta de **Google Play Console** — 25 USD, pago único
- [ ] Para una cuenta personal nueva: Google pide **12 probadores** durante
      **14 días seguidos** antes de dejar publicar. Empieza por ahí, no al final.
      Una cuenta de organización (con RUC) no tiene ese requisito.
- [ ] Una política de privacidad en una URL pública. Es obligatoria.

## 1. Crear la llave de firma

Se crea **una sola vez**. Si se pierde, no se puede volver a actualizar la app
con ese mismo paquete, nunca.

```bash
keytool -genkeypair -v \
  -keystore mi-fotito-release.jks \
  -alias mifotito \
  -keyalg RSA -keysize 2048 -validity 10000
```

Guarda el `.jks` y las contraseñas en un gestor de contraseñas y en un respaldo
aparte. **Fuera del repositorio** (`.gitignore` ya bloquea `*.jks`).

Deja las credenciales en `~/.gradle/gradle.properties`:

```properties
MIFOTITO_STORE_FILE=/ruta/absoluta/mi-fotito-release.jks
MIFOTITO_STORE_PASSWORD=...
MIFOTITO_KEY_ALIAS=mifotito
MIFOTITO_KEY_PASSWORD=...
```

## 2. Compilar el AAB

```bash
cd android-twa
./gradlew clean bundleRelease
```

Sube `app/build/outputs/bundle/release/app-release.aab`.

## 3. Crear la app en Play Console

- Nombre: **Mi Fotito**
- Idioma por defecto: **Español (Latinoamérica)**
- Tipo: **Aplicación**, gratuita
- Paquete: `pe.mifotito.app` *(no se puede cambiar después)*

## 4. Conectar la app con el dominio

Este es el paso que decide si la app se ve como app o como navegador.

1. Play Console → **Configuración → Firma de la aplicación**.
2. Copia **Certificado de la clave de firma de la app → huella SHA-256**.
3. Genera el archivo:

   ```bash
   ./gradlew :app:assetLinks -Pfingerprint=<la huella que copiaste>
   ```

4. Pega el resultado en `public/.well-known/assetlinks.json`, reemplazando el
   `REPLACE_WITH_PLAY_APP_SIGNING_SHA256` que está ahí ahora.
5. Despliega la web y comprueba:

   ```bash
   curl https://mifotito.com/.well-known/assetlinks.json
   ```

   Tiene que responder el JSON con `content-type: application/json`.

Sin este paso la app abre con la barra de direcciones de Chrome encima.

## 5. Ficha de la tienda

Lo listo está en `android-twa/play-assets/`.

| Campo | Qué poner |
| --- | --- |
| Ícono | `play-assets/play-icon-512.png` (512×512) |
| Gráfico destacado | `play-assets/feature-graphic-1024x500.png` (1024×500) |
| Capturas | Mínimo 2, en teléfono, 1080×1920. Falta tomarlas |
| Descripción corta | «Imprime tu foto y te la llevamos enmarcada a casa.» (máx. 80) |
| Descripción larga | Ver abajo |
| Categoría | Compras |
| Correo de contacto | El de soporte de Mi Fotito |
| Política de privacidad | URL pública |

Para las capturas, lo más rápido:

```bash
adb shell screencap -p /sdcard/s1.png && adb pull /sdcard/s1.png
```

Pantallas que venden: inicio, `/crear` con una foto dentro del marco, `/muro`,
y la confirmación de un pedido.

### Descripción larga (borrador)

```
Mi Fotito imprime tu foto y te la lleva enmarcada hasta tu casa, en Lima y a
provincias.

Elige la foto desde tu teléfono, mírala dentro del marco antes de pedirla, y
paga en soles con Izipay (tarjeta) o Mercado Pago (incluye Yape). Nosotros imprimimos, enmarcamos y
enviamos.

• Marcos desde S/ 59, con envío incluido
• Marcos de 15×20, cuadrados de 20×20 y de muro 30×40
• Arma un muro: trío, cuadrícula o mixto. El segundo marco va con 20% de
  descuento, y desde el tercero el set baja 15%
• Tarjetas navideñas con tu foto y tu mensaje
• Envoltorio de regalo, sin precios en la caja
• Tarjetas de regalo
• Rastrea tu pedido con tu celular

Hecho en Perú.
```

## 6. Cuestionarios obligatorios

**Seguridad de los datos.** Lo que la app recoge lo recoge el sitio web. Declara:

| Dato | Se recoge | Para qué |
| --- | --- | --- |
| Nombre, correo, celular | Sí | Hacer y entregar el pedido, y la cuenta |
| Dirección | Sí | Entrega |
| Fotos | Sí | Imprimir el pedido |
| Audio (mensaje de voz) | Sí, si la persona lo graba | Mensaje de voz en la tarjeta |
| DNI / RUC | Sí | Boleta o factura |
| Datos de pago | No los guarda la app | Los procesa Izipay / Mercado Pago |

Todo se manda cifrado (HTTPS) y la persona puede pedir que se borre su cuenta.
Google exige también un enlace para **borrar la cuenta** desde fuera de la app.

**Clasificación de contenido.** Compras, sin contenido sensible. Apto para todos.

**Público objetivo.** Mayores de 18 (se cobra dinero).

**Anuncios.** No tiene.

## 7. Prueba cerrada, luego producción

1. **Prueba interna** primero: se aprueba en minutos y se instala desde un enlace.
   Sirve para comprobar que la barra de Chrome ya no sale.
2. **Prueba cerrada** con los 12 probadores, si la cuenta es personal.
3. **Producción**. La primera revisión suele tardar de unos días a dos semanas.

## Probar la verificación antes de publicar

Para ver la app sin barra de direcciones sin esperar a Play, instala el APK
firmado con tu llave y pon **esa** huella en el sitio, en un deploy preview:

```bash
./gradlew assembleRelease
adb install -r app/build/outputs/apk/release/app-release.apk
```

O fuerza a Chrome a aceptar el enlace en un teléfono de desarrollo:

```bash
adb shell am set-debug-app --persistent pe.mifotito.app
adb shell 'echo "chrome --disable-digital-asset-link-verification-for-url=\"https://mifotito.com\"" > /data/local/tmp/chrome-command-line'
```

## Cada actualización

Solo hace falta volver a publicar cuando cambia algo de `android-twa/`.
Los cambios de la tienda llegan solos con el deploy de la web.

1. Sube `versionCode` en `app/build.gradle` (1 → 2 → 3…)
2. Ajusta `versionName` si corresponde
3. `./gradlew clean bundleRelease`
4. Nueva versión en Play Console, con las notas de la versión

## Lo que puede hacer que rechacen la app

| Riesgo | Cómo se evita aquí |
| --- | --- |
| Política 4.1: «solo es un sitio web» | Es un TWA verificado, con splash, enlaces y pantalla sin conexión propios, no un WebView |
| Sin política de privacidad | Hay que publicarla antes de enviar |
| Sin forma de borrar la cuenta | Hace falta una URL de borrado de cuenta en la ficha |
| Seguridad de los datos mal declarada | Usa la tabla de arriba |
| La app abre con la barra de Chrome | `assetlinks.json` con la huella equivocada (paso 4) |
