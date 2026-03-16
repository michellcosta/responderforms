/**
 * Servidor local - busca temas do Google Forms e retorna JSON
 * Sem CORS, sem Apps Script, sem proxies externos
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const FORMS_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSd5UX3FbvMhitt9M8YmAunUFzVW7g7zALSdvMXbJJbt_NOaoQ/viewform';
const TEMA_ENTRY_ID = 976109499;
const PORT = process.env.PORT || 8000;

function extrairTemas(html) {
  const temas = [];
  const excluir = ['Briefing Safety OTR', 'E-mail', 'Nome Completo', 'Escolher', 'Choose'];

  // 1. Busca pelo Entry ID no JSON
  const fbMatch = html.match(/FB_PUBLIC_LOAD_DATA_\s*=\s*(\[[\s\S]+?\]);\s*<\/script>/);
  if (fbMatch) {
    try {
      const data = JSON.parse(fbMatch[1]);
      const campos = data[1] && data[1][1];
      if (Array.isArray(campos)) {
        for (const c of campos) {
          if (c[4] && c[4][0] && c[4][0][0] === TEMA_ENTRY_ID) {
            const opts = c[4][0][1];
            if (Array.isArray(opts)) {
              opts.forEach(o => {
                const v = o[0];
                if (v && typeof v === 'string' && !excluir.includes(v)) temas.push(v);
              });
              return temas;
            }
          }
        }
      }
    } catch (e) {}
  }

  // 2. Força bruta: regex para opções
  const re = /\["([^"\\\[\]]+)",\s*null,\s*null,\s*null,\s*(?:null|\d+)\]/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const val = m[1].trim();
    if (val.length > 3 && !excluir.includes(val) && val.indexOf('http') === -1) {
      temas.push(val);
    }
  }
  return [...new Set(temas)].sort();
}

const server = http.createServer(async (req, res) => {
  // CORS para permitir requisições do front
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.end();

  // API: GET /api/temas
  if (req.url.startsWith('/api/temas') && req.method === 'GET') {
    try {
      let temas = [];
      const response = await fetch(FORMS_URL + '?cb=' + Date.now(), {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });
      const html = await response.text();
      if (html.includes('FB_PUBLIC_LOAD_DATA_')) {
        temas = extrairTemas(html);
      }
      // Fallback: arquivo temas.json (atualize quando adicionar temas no Forms)
      if (temas.length === 0) {
        const jsonPath = path.join(__dirname, 'temas.json');
        if (fs.existsSync(jsonPath)) {
          const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
          temas = data.temas || [];
        }
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ temas, total: temas.length }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ temas: [], erro: e.message }));
    }
    return;
  }

  // Arquivos estáticos
  let filePath = req.url === '/' ? 'index.html' : req.url.replace(/^\//, '').replace(/\?.*$/, '');
  if (filePath === 'index' || filePath === '') filePath = 'index.html';
  filePath = path.resolve(__dirname, filePath);
  if (path.relative(__dirname, filePath).startsWith('..')) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath);
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Server: http://localhost:${PORT}`);
  console.log(`API temas: http://localhost:${PORT}/api/temas`);
  console.log(`App: http://localhost:${PORT}/`);
});
