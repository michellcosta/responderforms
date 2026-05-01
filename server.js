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

function extrairJsonFB(html) {
  const idx = html.indexOf('FB_PUBLIC_LOAD_DATA_');
  if (idx === -1) return null;
  const start = html.indexOf('[', idx);
  if (start === -1) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (esc) { esc = false; continue; }
    if (c === '\\' && inStr) { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '[') depth++;
    else if (c === ']') { depth--; if (depth === 0) { try { return JSON.parse(html.slice(start, i + 1)); } catch(e) { return null; } } }
  }
  return null;
}

const EXCLUIR = ['Briefing Safety OTR', 'E-mail', 'Nome Completo', 'Escolher', 'Choose'];

/** Só campo Tema (976109499) em FB_PUBLIC — alinhado ao Worker (sem data-value global). */
function extrairTemas(html) {
  const temas = [];
  if (!html || typeof html !== 'string') return temas;
  const data = extrairJsonFB(html);
  if (!data) return temas;
  try {
    const campos = data[1] && data[1][1];
    if (!Array.isArray(campos)) return temas;
    for (const c of campos) {
      if (c[4] && c[4][0] && c[4][0][0] === TEMA_ENTRY_ID) {
        const opts = c[4][0][1];
        if (Array.isArray(opts)) {
          opts.forEach((o) => {
            const v = o[0];
            if (v && typeof v === 'string' && !EXCLUIR.includes(v)) temas.push(v);
          });
        }
        break;
      }
    }
  } catch (e) {}
  return [...new Set(temas)].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

const TEMAS_JSON = path.join(__dirname, 'temas.json');

function lerTemasArquivo() {
  try {
    if (!fs.existsSync(TEMAS_JSON)) return [];
    const data = JSON.parse(fs.readFileSync(TEMAS_JSON, 'utf8'));
    const arr = data.temas;
    return Array.isArray(arr) ? arr.filter((t) => t && String(t).trim()) : [];
  } catch (e) {
    return [];
  }
}

function salvarTemasArquivo(nomes) {
  const ordenado = [...new Set(nomes)].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  fs.writeFileSync(TEMAS_JSON, JSON.stringify({ temas: ordenado }, null, 2), 'utf8');
  return ordenado;
}

async function lerCorpoJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  try {
    return JSON.parse(raw || '{}');
  } catch (e) {
    return null;
  }
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8' };

  // API: POST /api/temas (importHtml, add, remove) — mesmo contrato do Pages/Worker
  if (req.url.startsWith('/api/temas') && req.method === 'POST') {
    const body = await lerCorpoJson(req);
    if (!body) {
      res.writeHead(400, jsonHeaders);
      return res.end(JSON.stringify({ error: 'JSON inválido' }));
    }
    const action = body.action;
    try {
      if (action === 'importHtml') {
        const html = body.html;
        if (typeof html !== 'string' || !html.trim()) {
          res.writeHead(400, jsonHeaders);
          return res.end(JSON.stringify({ error: 'Cole o HTML (código-fonte da página do Forms).' }));
        }
        const maxLen = 2_000_000;
        if (html.length > maxLen) {
          res.writeHead(400, jsonHeaders);
          return res.end(JSON.stringify({ error: 'HTML excede o limite permitido.' }));
        }
        const nomes = extrairTemas(html);
        if (nomes.length === 0) {
          res.writeHead(400, jsonHeaders);
          return res.end(JSON.stringify({
            error: 'Nenhum tema encontrado. O HTML precisa conter FB_PUBLIC_LOAD_DATA_ com o campo Tema.',
          }));
        }
        const temas = salvarTemasArquivo(nomes);
        res.writeHead(200, jsonHeaders);
        return res.end(JSON.stringify({
          temas,
          total: temas.length,
          synced: true,
          imported: true,
          temaCount: temas.length,
        }));
      }
      if (action === 'add') {
        const n = (body.nome || '').trim();
        if (!n) {
          res.writeHead(400, jsonHeaders);
          return res.end(JSON.stringify({ error: 'Nome inválido' }));
        }
        const list = lerTemasArquivo();
        if (!list.includes(n)) list.push(n);
        const temas = salvarTemasArquivo(list);
        res.writeHead(200, jsonHeaders);
        return res.end(JSON.stringify({ temas, total: temas.length }));
      }
      if (action === 'remove') {
        const n = (body.nome || '').trim();
        if (!n) {
          res.writeHead(400, jsonHeaders);
          return res.end(JSON.stringify({ error: 'Nome inválido' }));
        }
        const temas = salvarTemasArquivo(lerTemasArquivo().filter((t) => t !== n));
        res.writeHead(200, jsonHeaders);
        return res.end(JSON.stringify({ temas, total: temas.length }));
      }
      res.writeHead(400, jsonHeaders);
      return res.end(JSON.stringify({ error: 'Ação inválida' }));
    } catch (e) {
      res.writeHead(500, jsonHeaders);
      return res.end(JSON.stringify({ error: e.message }));
    }
  }

  // API: GET /api/temas — ?refresh=1 tenta Google e grava temas.json se vier lista
  if (req.url.startsWith('/api/temas') && req.method === 'GET') {
    try {
      const u = new URL(req.url, 'http://localhost');
      const refresh = u.searchParams.get('refresh') === '1';

      const doFetch = async () => {
        const response = await fetch(FORMS_URL + '?cb=' + Date.now(), {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept-Language': 'pt-BR,pt;q=0.9',
          },
        });
        const html = await response.text();
        const bloqueadoPorLogin =
          html.includes('Google Forms: Sign-in') ||
          html.includes('to continue to Google Forms');
        let temas = [];
        if (html.includes('FB_PUBLIC_LOAD_DATA_')) temas = extrairTemas(html);
        return { temas, httpStatus: response.status, bloqueadoPorLogin };
      };

      if (refresh) {
        const { temas: fetched, httpStatus, bloqueadoPorLogin } = await doFetch();
        if (fetched.length > 0) {
          const temas = salvarTemasArquivo(fetched);
          res.writeHead(200, jsonHeaders);
          return res.end(JSON.stringify({
            temas,
            total: temas.length,
            synced: true,
            httpStatus,
            bloqueadoPorLogin: false,
          }));
        }
        let temas = lerTemasArquivo();
        const warning = bloqueadoPorLogin
          ? 'Google Forms exigiu login. Mantivemos a lista salva localmente (temas.json).'
          : 'Não foi possível ler os temas no formulário; mantendo lista salva.';
        res.writeHead(200, jsonHeaders);
        return res.end(JSON.stringify({
          temas,
          total: temas.length,
          synced: false,
          httpStatus,
          bloqueadoPorLogin,
          warning,
        }));
      }

      let temas = lerTemasArquivo();
      if (temas.length > 0) {
        res.writeHead(200, jsonHeaders);
        return res.end(JSON.stringify({ temas, total: temas.length }));
      }
      const { temas: fromNet } = await doFetch();
      temas = fromNet;
      if (temas.length === 0) temas = lerTemasArquivo();
      if (temas.length > 0) salvarTemasArquivo(temas);
      res.writeHead(200, jsonHeaders);
      res.end(JSON.stringify({ temas, total: temas.length }));
    } catch (e) {
      res.writeHead(500, jsonHeaders);
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
