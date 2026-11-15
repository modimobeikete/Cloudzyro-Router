const http = require("http");

if (!process.env.TARGET) {
  console.error("Missing TARGET environment variable");
  process.exit(1);
}
const TARGET = new URL(process.env.TARGET);
const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
    if (req.url === "/_diag") {
    const net = require("net"), dns = require("dns");
    const tests = [[TARGET.hostname, Number(TARGET.port)], ["1.1.1.1", 443], ["1.1.1.1", 53], ["8.8.8.8", 853] ["1.1.1.1", 80], ];
    const out = [];
    dns.lookup(TARGET.hostname, (e, addr) => {
      const kind = e ? "dns-fail" : /^(127\.|10\.|192\.168\.|0\.)/.test(addr) ? "private/loopback" : "public";
      out.push("dns: " + kind);
      let left = tests.length;
      tests.forEach(([h, p]) => {
        const s = net.connect({ host: h, port: p, timeout: 4000 });
        const done = (r) => { out.push(h.replace(TARGET.hostname, "target") + ":" + p + " " + r); s.destroy(); if (--left === 0) { res.writeHead(200, { "content-type": "text/plain" }); res.end(out.join("\n")); } };
        s.on("connect", () => done("connected"));
        s.on("timeout", () => done("timeout"));
        s.on("error", (er) => done(er.code));
      });
    });
    return;
  }
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
  up.on("error", (err) => {
  console.error("upstream error:", err.code, err.message);
  if (!res.headersSent) res.writeHead(500, { "content-type": "text/plain" });
  res.end("upstream error: " + err.code);
});
  req.on("aborted", () => up.destroy());
  res.on("close", () => up.destroy());
  req.pipe(up);
}).listen(PORT, "0.0.0.0", () => console.log("listening on " + PORT));
