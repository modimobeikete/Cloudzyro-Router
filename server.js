const http = require("http");

if (!process.env.TARGET) {
  console.error("Missing TARGET environment variable");
  process.exit(1);
}
const TARGET = new URL(process.env.TARGET);
const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
  // 健康检查：根路径直接返回 200，不转发
  if ((req.method === "GET" || req.method === "HEAD") && (req.url === "/" || req.url === "/healthz")) {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
    return;
  }

  const headers = { ...req.headers };
  delete headers.host;

  const up = http.request(
    { hostname: TARGET.hostname, port: TARGET.port, path: req.url, method: req.method, headers },
    (r) => {
      res.writeHead(r.statusCode, { ...r.headers, "cache-control": "no-store", "x-accel-buffering": "no" });
      r.pipe(res);
    }
  );
  up.on("error", () => { if (!res.headersSent) res.writeHead(502); res.end(); });
  req.on("aborted", () => up.destroy());
  res.on("close", () => up.destroy());
  req.pipe(up);
}).listen(PORT, "0.0.0.0", () => console.log("listening on " + PORT));
