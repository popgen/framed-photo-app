// Turns the Express-style handlers in /api into a Netlify Functions v2 handler.
export function netlifyHandler(routeHandler) {
  return async (request) => {
    const url = new URL(request.url);
    const query = {};
    for (const [key, value] of url.searchParams.entries()) query[key] = value;

    let body = {};
    if (request.method !== "GET" && request.method !== "HEAD") {
      const text = await request.text();
      if (text) {
        try {
          body = JSON.parse(text);
        } catch {
          body = {};
        }
      }
    }

    let status = 200;
    let payload = "";
    let contentType = "application/json";
    const res = {
      status(code) {
        status = code;
        return res;
      },
      json(data) {
        payload = JSON.stringify(data);
        contentType = "application/json";
        return res;
      },
      send(data) {
        payload = data == null ? "" : String(data);
        contentType = "text/plain; charset=utf-8";
        return res;
      },
    };
    const req = { method: request.method, body, query, headers: Object.fromEntries(request.headers.entries()) };
    await routeHandler(req, res);
    return new Response(payload, {
      status,
      headers: { "content-type": contentType },
    });
  };
}
