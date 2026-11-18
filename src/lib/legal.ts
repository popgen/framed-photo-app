export const LEGAL_UPDATED = "18 de noviembre de 2026";

export type LegalSection = {
  id?: string;
  heading: string;
  paragraphs: string[];
};

export type LegalDoc = {
  path: "/privacidad" | "/terminos";
  title: string;
  titleTag: string;
  updated: string;
  intro: string[];
  sections: LegalSection[];
  englishTitle?: string;
  englishParagraphs?: string[];
};

export const privacyDoc: LegalDoc = {
  path: "/privacidad",
  title: "Política de privacidad",
  titleTag: "Política de privacidad — Mi Fotito",
  updated: LEGAL_UPDATED,
  intro: [
    "Esta política explica qué datos usa Mi Fotito y para qué. Está escrita en español. Al final hay un resumen corto en inglés.",
  ],
  sections: [
    {
      heading: "Quiénes somos",
      paragraphs: [
        "Mi Fotito imprime fotos enmarcadas en Lima, Perú, y las lleva a domicilio. El sitio es https://mifotito.com.",
        "Para cualquier consulta sobre tus datos escribe a pedidos@mifotito.com.",
      ],
    },
    {
      heading: "Qué datos recogemos",
      paragraphs: [
        "Para armar y entregar el pedido usamos tu nombre, celular, correo, dirección de entrega y el detalle del pedido (marco, tarjeta, texto y mensaje de voz, si lo agregas).",
        "El pago lo procesa el proveedor de pagos. Nosotros no guardamos el número completo de tu tarjeta.",
        "También guardamos las fotos que subes desde tu teléfono o que eliges para el pedido, y la foto de un reclamo si nos escribes porque llegó dañado.",
      ],
    },
    {
      heading: "Google Photos, Facebook e Instagram",
      paragraphs: [
        "Si importas fotos desde Google Photos, solo recibimos las que tú eliges en el selector de Google Photos. El permiso es photospicker.mediaitems.readonly, además del ingreso básico a la cuenta. No vemos el resto de tu biblioteca ni tus contactos.",
        "Si más adelante activamos Facebook o Instagram, el límite es el mismo: solo las fotos que tú elijas en esa importación, no el resto de la cuenta ni tus contactos.",
        "El token de acceso de Google se usa solo durante esa importación. Viaja en una cookie de corta duración y no lo guardamos en nuestra base de datos. A los 10 minutos, o al terminar la importación, deja de existir. Lo mismo vale para Facebook o Instagram si esa importación está activa.",
        "Declaración de Uso limitado: Mi Fotito's use and transfer to any other app of information received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements.",
      ],
    },
    {
      heading: "Para qué los usamos",
      paragraphs: [
        "Usamos esos datos solo para producir, imprimir y entregar el producto que pediste, y para escribirte sobre ese pedido.",
        "No vendemos tus datos. No los usamos para publicidad. No entrenamos modelos de inteligencia artificial con tus fotos ni con tus datos.",
        "Quien imprime el pedido ve la foto para producirla. Nadie más la usa.",
      ],
    },
    {
      heading: "Cuánto tiempo guardamos las fotos",
      paragraphs: [
        "Las fotos viven en un depósito privado, solo el tiempo necesario para producir y entregar el pedido.",
        "Las borramos dentro de los 30 días después de la entrega. Si el pedido se cancela, también las borramos dentro de los 30 días siguientes a la cancelación.",
        "Si subiste una foto y no quedó ligada a ningún pedido, la borramos a los 30 días.",
        "El audio del mensaje de voz se conserva para que el código QR del marco siga abriendo ese mensaje. La selfie que acompaña al mensaje se trata como el resto de las fotos.",
      ],
    },
    {
      heading: "Tus derechos",
      paragraphs: [
        "La Ley N.° 29733, Ley de protección de datos personales del Perú, te da los derechos de acceso, rectificación, cancelación y oposición.",
        "Para usarlos escribe a pedidos@mifotito.com. Te respondemos por el mismo medio.",
      ],
    },
    {
      id: "eliminar-datos",
      heading: "Eliminar mis datos",
      paragraphs: [
        "Escribe a pedidos@mifotito.com con el asunto «Eliminar mis datos». Indica el correo y el celular del pedido.",
        "Borramos la cuenta, los datos del pedido y las fotos que todavía tengamos. Las fotos de un pedido entregado o cancelado ya se borran solas dentro de los 30 días siguientes.",
        "Esta página es la dirección para pedir la eliminación de datos: https://mifotito.com/privacidad#eliminar-datos. Sirve también cuando una red social pide una página para eliminar datos.",
      ],
    },
    {
      heading: "Cookies",
      paragraphs: [
        "Usamos una sola cookie de importación, mifotito-import. Dura unos 10 minutos y solo sirve mientras eliges fotos de Google Photos, o de Facebook o Instagram si esa opción está activa.",
        "La sesión de tu cuenta se guarda en el almacenamiento del navegador para que no tengas que entrar en cada visita. No es una cookie de publicidad.",
        "No usamos cookies de anuncios ni de seguimiento.",
      ],
    },
    {
      heading: "Cambios",
      paragraphs: [
        "Si esta política cambia, actualizamos esta página y la fecha de arriba.",
      ],
    },
  ],
  englishTitle: "English summary",
  englishParagraphs: [
    "Mi Fotito prints framed photos in Lima, Peru. Contact pedidos@mifotito.com.",
    "We collect your name, phone, email, delivery address, order details, and the photos you choose. The payment provider handles the payment. We do not keep the full card number.",
    "Google Photos import receives only the photos you pick in the Google Photos Picker, with the scope photospicker.mediaitems.readonly, plus basic account sign-in. We do not see the rest of your library and we do not read your contacts. The same limit applies to Facebook or Instagram if those imports are turned on later. The Google access token is used only during that import, lives in a short cookie, and is not stored in our database.",
    "We use this information only to produce, print, and deliver your order and to contact you about that order. We do not sell it, we do not use it for ads, and we do not use it to train AI models.",
    "Mi Fotito's use and transfer to any other app of information received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements.",
    "Photos stay in a private bucket only as long as needed to make and deliver the order, and are deleted within 30 days after delivery (or after cancellation). Files that never became an order are deleted after 30 days. Voice-message audio is kept so the QR code on the frame still opens it.",
    "Under Peru's Law No. 29733 you can ask to access, correct, or delete your data by emailing pedidos@mifotito.com. Deletion instructions are on this page at https://mifotito.com/privacidad#eliminar-datos.",
  ],
};

export const termsDoc: LegalDoc = {
  path: "/terminos",
  title: "Términos y condiciones",
  titleTag: "Términos y condiciones — Mi Fotito",
  updated: LEGAL_UPDATED,
  intro: [
    "Al pedir en Mi Fotito aceptas estas condiciones. Son cortas, a propósito.",
  ],
  sections: [
    {
      heading: "Pedidos",
      paragraphs: [
        "El pedido queda hecho cuando lo confirmas en https://mifotito.com y el pago se aprueba. Te escribimos al correo o al celular del pedido.",
        "Mi Fotito está en Lima, Perú. El contacto es pedidos@mifotito.com.",
      ],
    },
    {
      heading: "Precios",
      paragraphs: [
        "Los precios están en soles e incluyen el envío, tal como se muestran al pagar. El envoltorio de regalo, si lo pides, se cobra aparte.",
      ],
    },
    {
      heading: "Entrega y Navidad",
      paragraphs: [
        "En Lima y Callao el envío toma de 2 a 3 días hábiles. A provincias, de 3 a 5 días hábiles. Son estimados: el tráfico y la ruta pueden mover la fecha.",
        "Para Navidad 2026, el corte es el 18 de diciembre en Lima y el 15 de diciembre si el pedido va a provincias. La hora es la de Lima. Después de esa fecha seguimos imprimiendo, pero ya no prometemos que llegue antes de Navidad.",
      ],
    },
    {
      heading: "Reclamos",
      paragraphs: [
        "Si el marco o la tarjeta llega dañado, entra al enlace del pedido y abre «Llegó dañado», o ve a /reclamo. Cuéntanos qué pasó y, si puedes, manda una foto. Te escribimos por WhatsApp.",
        "Ahí mismo pedimos la reposición. No tenemos un libro de reclamaciones aparte: ese es el camino.",
      ],
    },
    {
      heading: "Tus fotos",
      paragraphs: [
        "Al subir o elegir una foto confirmas que tienes derecho a usarla para imprimirla y entregarla. Mi Fotito no reclama la autoría de tus fotos.",
        "Cómo guardamos y borramos las fotos está en la Política de privacidad: /privacidad.",
      ],
    },
    {
      heading: "Contacto",
      paragraphs: [
        "Pedidos, datos personales y reclamos: pedidos@mifotito.com.",
      ],
    },
  ],
};

const LINK = /(https:\/\/mifotito\.com\/privacidad#eliminar-datos|https:\/\/mifotito\.com|pedidos@mifotito\.com|\/privacidad|\/terminos|\/reclamo)/g;

export function linkParts(text: string): { text: string; href?: string }[] {
  const parts: { text: string; href?: string }[] = [];
  let cursor = 0;
  for (const match of text.matchAll(LINK)) {
    const index = match.index ?? 0;
    if (index > cursor) parts.push({ text: text.slice(cursor, index) });
    const token = match[0];
    parts.push({ text: token, href: token.includes("@") ? `mailto:${token}` : token });
    cursor = index + token.length;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) });
  if (!parts.length) parts.push({ text });
  return parts;
}
