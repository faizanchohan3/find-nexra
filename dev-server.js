// Local test server: `node dev-server.js` then open http://localhost:3000
// On Vercel this file is not used — Vercel serves /public and /api itself.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";

const routes = {
  "/api/search": (await import("./api/search.js")).default,
  "/api/product": (await import("./api/product.js")).default,
  "/api/status": (await import("./api/status.js")).default,
};
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };

http.createServer(async (req, res) => {
  const path = new URL(req.url, "http://x").pathname;
  if (routes[path]) return routes[path](req, res);
  const file = join("public", path === "/" ? "index.html" : path);
  try {
    const body = await readFile(file);
    res.setHeader("content-type", types[extname(file)] || "application/octet-stream");
    res.end(body);
  } catch {
    res.statusCode = 404; res.end("Not found");
  }
}).listen(process.env.PORT || 3000, () => console.log("findNexra on http://localhost:" + (process.env.PORT || 3000)));
