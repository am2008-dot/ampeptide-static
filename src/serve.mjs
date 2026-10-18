// Tiny static preview server for the built site (dist/).
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(dirname(fileURLToPath(import.meta.url))), 'dist');
const PORT = process.env.PORT || 4173;
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.xml': 'application/xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp', '.md': 'text/markdown' };

createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  let file = join(ROOT, p);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file) && !extname(file)) {
    file = join(ROOT, p + '/index.html');
    if (!existsSync(file)) file = join(ROOT, '404.html');
  }
  if (!existsSync(file)) { res.writeHead(404); res.end('Not found'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
}).listen(PORT, () => console.log(`Preview: http://localhost:${PORT}`));
