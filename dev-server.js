// Local test server: `node dev-server.js` then open http://localhost:3000
// On Vercel this file is not used — Vercel serves /public and /api itself.
import http from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";

const routes = {};
for (const f of await readdir("api")) if (f.endsWith(".js")) routes["/api/" + f.slice(0, -3)] = (await import("./api/" + f)).default;
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json" };

http.createServer(async (req, res) => {
  const path = new URL(req.url, "http://x").pathname;
  if (routes[path]) return routes[path](req, res);
  let file = join("public", path === "/" ? "index.html" : path);
  if (!extname(file)) file += ".html";
  try {
    const body = await readFile(file);
    res.setHeader("content-type", types[extname(file)] || "application/octet-stream");
    res.end(body);
  } catch {
    res.statusCode = 404; res.end("Not found");
  }
}).listen(process.env.PORT || 3000, () => console.log("findNexra on http://localhost:" + (process.env.PORT || 3000)));
