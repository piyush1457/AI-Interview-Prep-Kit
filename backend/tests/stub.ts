import http from "http";

// Tiny stub origin for crawler/SSRF tests. Routes:
// /ok -> page with links to /careers and /about
// /careers -> hiring page text
// /about -> about text
// /no-hiring -> page with zero hiring signals and no links
// /redirect-private -> 302 to http://169.254.169.254/ (must be blocked per hop)
// /robots.txt -> allow all
export function startStub(): Promise<{ base: string; close: () => Promise<void> }> {
  const server = http.createServer((req, res) => {
    const url = req.url || "/";
    if (url === "/robots.txt") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("User-agent: *\nAllow: /\n");
      return;
    }
    if (url === "/redirect-private") {
      res.writeHead(302, { Location: "http://169.254.169.254/" });
      res.end();
      return;
    }
    if (url === "/no-hiring") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<html><body><h1>Acme</h1><p>We sell widgets. Contact us.</p></body></html>");
      return;
    }
    if (url === "/careers") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<html><body><h1>Careers</h1><p>We are hiring engineers. Take-home exercise then system design round.</p></body></html>");
      return;
    }
    if (url === "/about") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<html><body><h1>About Acme</h1><p>Acme builds widgets for developers.</p></body></html>");
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<html><body><h1>Acme</h1><a href="/careers">Careers</a><a href="/about">About us</a><a href="/no-hiring">Misc</a></body></html>`);
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr: any = server.address();
      resolve({
        base: `http://127.0.0.1:${addr.port}`,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}
