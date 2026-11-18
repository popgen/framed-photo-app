const CM = 2.54;

export function printDpi(width, height, wCm, hCm) {
  return Math.min(width / (wCm / CM), height / (hCm / CM));
}

export function dpiStatus(dpi) {
  const shown = Math.round(dpi);
  if (shown >= 300) return "good";
  if (shown >= 150) return "soft";
  return "low";
}

export function emptySession(phone, token) {
  return {
    phone,
    token,
    step: "collect",
    photos: [],
    frameId: null,
    mode: null,
    needsHuman: false,
    orderCreated: false,
  };
}

function soles(cents) {
  return `S/ ${Math.round(cents / 100)}`;
}

function assess(photo, frame) {
  const dpi = printDpi(photo.width, photo.height, frame.printWcm, frame.printHcm);
  return { dpi: Math.round(dpi), status: dpiStatus(dpi) };
}

function smallerFrame(catalog, frame, photo) {
  const area = frame.printWcm * frame.printHcm;
  return catalog
    .filter((item) => item.printWcm * item.printHcm < area - 0.1)
    .map((item) => ({ item, dpi: printDpi(photo.width, photo.height, item.printWcm, item.printHcm) }))
    .filter((item) => Math.round(item.dpi) >= 150)
    .sort((a, b) => b.item.printWcm * b.item.printHcm - a.item.printWcm * a.item.printHcm)[0]?.item;
}

function qualityLine(catalog, frame, photo) {
  const check = assess(photo, frame);
  if (check.status === "good") return "La foto tiene buena resolución para imprimir.";
  if (check.status === "soft") return `La foto está en ${check.dpi} dpi. Se imprime, y de cerca se verá un poco suave.`;
  const suggestion = smallerFrame(catalog, frame, photo);
  return suggestion
    ? `Ojo: a ${check.dpi} dpi esta foto queda chica para ${frame.sizeLabel}. Se vería mejor en ${suggestion.sizeLabel}.`
    : `Ojo: a ${check.dpi} dpi la foto no alcanza para una impresión nítida. Si tienes una más grande, mándala.`;
}

function frameList(catalog) {
  return {
    kind: "list",
    body: "Elige el marco. El precio ya incluye el acrílico y el envío.",
    button: "Ver marcos",
    rows: catalog.map((frame) => ({
      id: frame.id,
      title: frame.name.slice(0, 24),
      description: `${frame.sizeLabel} · ${soles(frame.priceCents)}`.slice(0, 72),
    })),
  };
}

function linkFor(origin, token, pago) {
  const url = `${origin.replace(/\/$/, "")}/w/${token}`;
  return pago ? `${url}?pago=${pago}` : url;
}

export function reduceWa(session, event, ctx) {
  const catalog = ctx.catalog;
  const origin = ctx.origin || "http://localhost:8081";
  const current = session ? { ...session, photos: [...session.photos] } : emptySession(event.phone || "", event.token || `wa${Date.now().toString(36)}`);
  if (event.phone) current.phone = event.phone;
  const replies = [];
  let createOrder = false;

  if (event.type === "image") {
    current.photos.push({ width: event.width, height: event.height });
    current.step = current.photos.length > 1 ? "choose_mode" : "choose_frame";
    const base = catalog.find((frame) => frame.id === "thin-black-15") || catalog[0];
    const note = qualityLine(catalog, base, current.photos.at(-1));
    replies.push({ kind: "text", body: `Recibí tu foto ${current.photos.length}. ${note}` });
    if (current.photos.length > 1) {
      replies.push({
        kind: "buttons",
        body: `Ya van ${current.photos.length} fotos. ¿Las armamos en un muro o cada una en el mismo marco?`,
        buttons: [
          { id: "mode_wall", title: "Muro de fotos" },
          { id: "mode_set", title: "Mismos marcos" },
          { id: "human", title: "Hablar con alguien" },
        ],
      });
    } else {
      replies.push(frameList(catalog));
    }
    return { session: current, replies, createOrder };
  }

  const choice = event.type === "select" ? event.id : "";
  if (event.type === "text") {
    const text = (event.text || "").toLowerCase();
    if (text.includes("persona") || text.includes("asesor") || text.includes("humano")) {
      return human(current, origin, ctx.supportNumber);
    }
    if (current.step === "collect" || !current.photos.length) {
      replies.push({ kind: "text", body: "Mándame la foto por aquí (puedes enviar varias) y te la dejo lista para imprimir y pagar." });
      return { session: current, replies, createOrder };
    }
  }

  if (choice === "human") return human(current, origin, ctx.supportNumber);
  if (choice === "mode_wall") {
    current.mode = "wall";
    current.step = "pay";
    current.frameId = null;
    replies.push({
      kind: "text",
      body: `Armemos el muro con tus ${current.photos.length} fotos. Ábrelo en el celular, acomoda cada foto y paga: ${linkFor(origin, current.token)}`,
    });
    replies.push(payButtons());
    createOrder = !current.orderCreated;
    current.orderCreated = true;
    return { session: current, replies, createOrder };
  }
  if (choice === "mode_set") {
    current.mode = "set";
    current.step = "choose_frame";
    replies.push(frameList(catalog));
    return { session: current, replies, createOrder };
  }
  if (choice === "change") {
    current.step = "choose_frame";
    replies.push(frameList(catalog));
    return { session: current, replies, createOrder };
  }
  const frame = catalog.find((item) => item.id === choice);
  if (frame) {
    current.frameId = frame.id;
    current.mode = current.photos.length > 1 ? "set" : "single";
    current.step = "confirm";
    const notes = current.photos.map((photo, index) => `Foto ${index + 1}: ${qualityLine(catalog, frame, photo)}`).join(" ");
    replies.push({
      kind: "buttons",
      body: `${frame.name} · ${frame.sizeLabel} · ${soles(frame.priceCents)}. ${notes}`,
      buttons: [
        { id: "confirm", title: "Confirmar" },
        { id: "change", title: "Cambiar marco" },
        { id: "human", title: "Hablar con alguien" },
      ],
    });
    return { session: current, replies, createOrder };
  }
  if (choice === "confirm") {
    current.step = "pay";
    createOrder = !current.orderCreated;
    current.orderCreated = true;
    replies.push({
      kind: "text",
      body: `Listo. Mira la foto dentro del marco y termina el pago aquí: ${linkFor(origin, current.token)}`,
    });
    replies.push(payButtons());
    return { session: current, replies, createOrder };
  }
  if (choice === "pay_yape" || choice === "pay_plin" || choice === "pay_card") {
    const pago = choice.replace("pay_", "");
    const label = pago === "yape" ? "Yape" : pago === "plin" ? "Plin" : "tarjeta";
    replies.push({
      kind: "text",
      body: `Paga con ${label} en este enlace. Ahí también puedes cambiar la dirección: ${linkFor(origin, current.token, pago)}`,
    });
    return { session: current, replies, createOrder };
  }
  if (!current.photos.length) {
    replies.push({ kind: "text", body: "Mándame una foto y seguimos. Si prefieres a una persona, escribe ASESOR." });
  }
  return { session: current, replies, createOrder };
}

function payButtons() {
  return {
    kind: "buttons",
    body: "¿Cómo quieres pagar? El enlace abre el checkout con tu foto.",
    buttons: [
      { id: "pay_yape", title: "Pagar con Yape" },
      { id: "pay_plin", title: "Pagar con Plin" },
      { id: "pay_card", title: "Pagar con tarjeta" },
    ],
  };
}

function human(session, origin, supportNumber) {
  session.step = "human";
  session.needsHuman = true;
  const link = session.photos.length ? ` Tu enlace sigue activo: ${linkFor(origin, session.token)}` : "";
  return {
    session,
    createOrder: false,
    replies: [
      {
        kind: "text",
        body: `Te paso con el equipo de Recuerdo${supportNumber ? ` por el ${supportNumber}` : ""}.${link} Si quieres seguir por aquí, mándame otra foto.`,
      },
    ],
  };
}
