// Turns the Express-style handlers in /api into a Netlify Functions v2 handler.
export function netlifyHandler(routeHandler) {
  return async (request) => {
    const url = new URL(request.url);
    const query = {};
    for (const [key, value] of url.searchParams.entries()) query[key] = value;

    let body = {};
    let rawBody = "";
    if (request.method !== "GET" && request.method !== "HEAD") {
      const text = await request.text();
      rawBody = text;
      const contentType = request.headers.get("content-type") || "";
      if (text) {
        if (contentType.includes("application/x-www-form-urlencoded")) body = Object.fromEntries(new URLSearchParams(text));
        else {
          try {
            body = JSON.parse(text);
          } catch {
            body = Object.fromEntries(new URLSearchParams(text));
          }
        }
      }
    }

    let status = 200;
    let payload = "";
    let headers = { "content-type": "application/json" };
    const res = {
      status(code) {
        status = code;
        return res;
      },
      json(data) {
        payload = JSON.stringify(data);
        headers = { "content-type": "application/json" };
        return res;
      },
      send(data) {
        payload = data == null ? "" : String(data);
        headers = { "content-type": "text/plain; charset=utf-8" };
        return res;
      },
      html(markup) {
        payload = markup == null ? "" : String(markup);
        headers = { "content-type": "text/html; charset=utf-8" };
        return res;
      },
      redirect(url, extra = {}) {
        status = 303;
        payload = "";
        headers = { location: url, ...extra };
        return res;
      },
      bytes(data, type) {
        payload = data;
        headers = { "content-type": type, "cache-control": "private, max-age=60" };
        return res;
      },
    };
    const req = { method: request.method, body, rawBody, query, headers: Object.fromEntries(request.headers.entries()) };
    await routeHandler(req, res);
    return new Response(payload, { status, headers });
  };
}
