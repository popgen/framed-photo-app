# Mi Fotito para Android

La app de Android es un **Trusted Web Activity (TWA)**: abre `https://mifotito.com`
con el motor del navegador del teléfono, a pantalla completa, sin barra de
direcciones ni botones de navegador. Para la persona es una app; por dentro es la
misma tienda que ya está en línea.

Por eso no hay que mantener dos tiendas: cada vez que se despliega la web,
la app queda actualizada sin pasar por la Play Store. Solo se vuelve a publicar
cuando cambia algo de esta carpeta (ícono, nombre, permisos, versión).

## Qué le pone de nativo

| | |
| --- | --- |
| Ícono adaptativo | Capas foreground / background / monochrome, con el tema de Android 13 |
| Splash | Pantalla de inicio del sistema (Android 12+) y la del navegador, las dos en `#F6EFE6`, así no hay parpadeo blanco |
| Sin barra del navegador | Verificado con Digital Asset Links (ver abajo) |
| Enlaces | Un `https://mifotito.com/...` tocado en WhatsApp abre la app, no el navegador |
| Sin conexión | Pantalla nativa en español con botón **Reintentar**, en vez del dinosaurio de Chrome |
| Recents | Una sola tarjeta, con el nombre y el ícono de Mi Fotito |
| Barras del sistema | Status bar y navigation bar con los colores de la tienda |
| Tamaño | ~1.3 MB el AAB. No hay copia del sitio dentro de la app |

Si el teléfono no tiene un navegador que soporte TWA, `androidbrowserhelper` cae
solo a una Custom Tab. La tienda sigue funcionando; solo se ve la barra de URL.

## Requisitos para compilar

- JDK 17 o más nuevo
- Android SDK con `platforms;android-36` y `build-tools;36.0.0`
- `ANDROID_HOME` apuntando al SDK, o un `local.properties` con `sdk.dir=/ruta/al/sdk`

```bash
cd android-twa
./gradlew assembleDebug
```

El APK de prueba queda en `app/build/outputs/apk/debug/app-debug.apk`.
Su `applicationId` lleva el sufijo `.debug`, así que se puede instalar al lado de
la versión de la tienda.

```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

> El APK de debug **sí muestra la barra de direcciones**: la verificación de
> Digital Asset Links falla porque el paquete es `pe.mifotito.app.debug` y la
> firma es la de debug. Eso es normal. Para probar sin barra, ver
> «Probar la verificación» en [PLAY_STORE.md](PLAY_STORE.md).

## Compilar para la Play Store

```bash
./gradlew bundleRelease \
  -PMIFOTITO_STORE_FILE=/ruta/mi-fotito.jks \
  -PMIFOTITO_STORE_PASSWORD=... \
  -PMIFOTITO_KEY_ALIAS=mifotito \
  -PMIFOTITO_KEY_PASSWORD=...
```

Sale `app/build/outputs/bundle/release/app-release.aab`. Los pasos completos
(crear la llave, la cuenta, la ficha, la revisión) están en
[PLAY_STORE.md](PLAY_STORE.md).

Lo más cómodo es dejar las cuatro propiedades en `~/.gradle/gradle.properties`
para no escribirlas cada vez. **Nunca** en este repositorio.

## Digital Asset Links

Chrome esconde la barra de direcciones solo si el sitio y la app se reconocen:

1. La app declara el sitio. Está en `app/build.gradle` (`twaHost`), y de ahí sale
   el recurso `asset_statements`.
2. El sitio declara la app, en `https://mifotito.com/.well-known/assetlinks.json`.
   Ese archivo vive en `public/.well-known/assetlinks.json`, en la raíz del repo,
   y Netlify lo publica tal cual.

Para saber qué poner en el sitio:

```bash
./gradlew :app:assetLinks -Pfingerprint=<SHA-256 de Play Console>
```

La huella correcta es la que da **Play Console → Configuración → Firma de la
aplicación**, no la de tu llave local: Google vuelve a firmar el AAB con su
propia llave. Hasta que ese archivo tenga la huella buena, la app abre con la
barra de Chrome a la vista.

## Cambiar algo

| Qué | Dónde |
| --- | --- |
| Dominio | `twaHost` en `app/build.gradle` (actualiza manifest, deep links y asset links) |
| Nombre | `app_name` en `app/src/main/res/values/strings.xml` |
| Colores | `app/src/main/res/values/colors.xml` (espejo de `src/components/theme.ts`) |
| Ícono | `assets/android-icon-*.png` en la raíz, y volver a generar los mipmaps |
| Versión | `versionCode` y `versionName` en `app/build.gradle` |
| Texto de «sin conexión» | `strings.xml` |

`versionCode` tiene que subir de uno en uno en cada subida a la Play Store.
`versionName` es lo que ve la gente (`1.0.0`, `1.1.0`, …).

## Por qué TWA y no un WebView

Un `WebView` propio parece el camino corto, pero:

- La política **4.1 de Google Play** rechaza apps que solo reempaquetan un sitio.
  Un TWA es el camino que Google documenta para publicar una web como app.
- El `WebView` no comparte sesión, autocompletado ni contraseñas con Chrome.
  La persona tendría que volver a entrar a su cuenta dentro de la app.
- Izipay, Yape y Mercado Pago abren pasarelas de pago. En Chrome funcionan; en un
  `WebView` sin configurar se rompen los redirects de 3-D Secure.
- El `WebView` de un teléfono viejo se queda atrás; el TWA usa el Chrome que la
  persona ya actualiza sola.
