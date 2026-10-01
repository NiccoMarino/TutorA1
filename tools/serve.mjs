// Server locale per provare la pagina nel browser: serve i file del progetto
// e permette all'harness di collaudo di salvare i risultati in test/fixtures/.
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, join, normalize, basename } from 'node:path';

const root = process.cwd();
const port = Number(process.env.PORT) || 5173;
const TYPES = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.png':'image/png', '.svg':'image/svg+xml', '.ico':'image/x-icon'
};

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (req.method === 'PUT' && url.pathname.startsWith('/__save/')){
      const name = basename(url.pathname);
      if (!/^[\w.-]+\.json$/.test(name)){ res.writeHead(400).end('nome non valido'); return; }
      const chunks = [];
      for await (const c of req) chunks.push(c);
      await writeFile(join(root, 'test', 'fixtures', name), Buffer.concat(chunks));
      res.writeHead(200).end('salvato ' + name);
      return;
    }
    let path = decodeURIComponent(url.pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = normalize(join(root, path));
    if (!file.startsWith(root)){ res.writeHead(403).end(); return; }
    const body = await readFile(file);
    res.writeHead(200, {'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store'}).end(body);
  } catch (e) {
    res.writeHead(404).end('non trovato');
  }
}).listen(port, '127.0.0.1', () => console.log('http://localhost:' + port + '/'));
