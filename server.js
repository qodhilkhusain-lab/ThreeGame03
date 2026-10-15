const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 3000);
const ROOT_DIR = __dirname;
const DATA_FILE = path.join(ROOT_DIR, 'data.json');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

function readDbFromFile() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    return { units: [], products: [], history: [] };
  }
}

function writeDbToFile(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/api/db') {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(readDbFromFile()));
      return;
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      let body = '';

      req.on('data', chunk => {
        body += chunk;
      });

      req.on('end', () => {
        try {
          const parsed = JSON.parse(body || '{}');
          writeDbToFile(parsed);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: true }));
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, message: 'Invalid JSON body' }));
        }
      });
      return;
    }
  }

  let requestPath = url.pathname === '/' ? '/index.html' : url.pathname;
  let safePath = path.normalize(requestPath).replace(/^\/+/, '');
  let filePath = path.join(ROOT_DIR, safePath);

  if (!filePath.startsWith(ROOT_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404);
        res.end('Not found');
      } else {
        res.writeHead(500);
        res.end('Internal server error');
      }
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
});

function listenOnAvailablePort(port, attempts = 0) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    console.error(`Port tidak valid: ${port}`);
    process.exitCode = 1;
    return;
  }

  const handleListenError = error => {
    if (error.code === 'EADDRINUSE' && port > 0 && attempts < 20 && port < 65535) {
      server.removeListener('error', handleListenError);
      const nextPort = port + 1;
      console.warn(`Port ${port} sedang digunakan. Mencoba port ${nextPort}...`);
      listenOnAvailablePort(nextPort, attempts + 1);
      return;
    }

    console.error(`Gagal menjalankan server pada port ${port}: ${error.message}`);
    process.exitCode = 1;
  };

  server.once('error', handleListenError);
  server.listen(port, () => {
    server.removeListener('error', handleListenError);
    const address = server.address();
    const activePort = address && typeof address === 'object' ? address.port : port;
    console.log(`Server running at http://localhost:${activePort}`);
  });
}

listenOnAvailablePort(PORT);
