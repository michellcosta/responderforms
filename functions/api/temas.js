const FORMS_VIEW   = 'https://docs.google.com/forms/d/e/1FAIpQLSd5UX3FbvMhitt9M8YmAunUFzVW7g7zALSdvMXbJJbt_NOaoQ/viewform';
const TEMA_ENTRY   = 976109499;
const EXCLUIR_LIST = ['Briefing Safety OTR', 'E-mail', 'Nome Completo', 'Escolher', 'Choose'];

/** Lista alinhada ao Forms (fallback quando não há D1 ou sync falha). */
const NOMES_PADRAO = [
  'Ataque de Cães',
  'Boas Práticas (Como Agir em Caso de Sinistro)',
  'Campanha Pátio + Seguro',
  'Campanha Trajeto Seguro - Trajeto',
  'Condições Adversas - Raios',
  'Cuidados em Periodo de Chuva',
  'Distância Segura',
  "EPI'S & Adornos",
  'Preferência No Trânsito',
  'Regras de Segurança',
  'Risco com Celular',
  'Segurança no período de férias',
  'Veículo Desligado',
];

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: HEADERS });
}

async function garantirTabela(db) {
  await db.prepare(
    'CREATE TABLE IF NOT EXISTS temas (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL UNIQUE)'
  ).run();
}

async function semear(db) {
  const stmt = db.prepare('INSERT OR IGNORE INTO temas (nome) VALUES (?)');
  await db.batch(NOMES_PADRAO.map(n => stmt.bind(n)));
}

async function listar(db) {
  const r = await db.prepare('SELECT nome FROM temas ORDER BY nome ASC').all();
  return (r.results || []).map(row => row.nome);
}

async function substituirTemas(db, nomes) {
  await db.prepare('DELETE FROM temas').run();
  if (nomes.length === 0) return;
  const stmt = db.prepare('INSERT INTO temas (nome) VALUES (?)');
  await db.batch(nomes.map((n) => stmt.bind(n)));
}

/**
 * Só extrai opções do campo Tema (entry 976109499) em FB_PUBLIC_LOAD_DATA_.
 * Não varre data-value nem regex no HTML inteiro — evita misturar Cargo, Empresa, Site, etc.
 */
function extrairTemasDoHtml(html) {
  const temas = [];
  if (!html || typeof html !== 'string' || !html.includes('FB_PUBLIC_LOAD_DATA_')) {
    return temas;
  }
  const idx = html.indexOf('FB_PUBLIC_LOAD_DATA_');
  const start = html.indexOf('[', idx);
  if (start === -1) return temas;

  let depth = 0;
  let inStr = false;
  let esc = false;
  let jsonStr = '';
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (esc) { esc = false; jsonStr += c; continue; }
    if (c === '\\' && inStr) { esc = true; jsonStr += c; continue; }
    if (c === '"') { inStr = !inStr; jsonStr += c; continue; }
    if (!inStr) {
      if (c === '[') depth++;
      else if (c === ']') { depth--; jsonStr += c; if (depth === 0) break; continue; }
    }
    jsonStr += c;
  }
  try {
    const data = JSON.parse(jsonStr);
    const campos = data[1] && data[1][1];
    if (Array.isArray(campos)) {
      for (const c of campos) {
        if (c[4] && c[4][0] && c[4][0][0] === TEMA_ENTRY) {
          const opts = c[4][0][1];
          if (Array.isArray(opts)) {
            opts.forEach((o) => {
              const v = o[0];
              if (v && typeof v === 'string' && !EXCLUIR_LIST.includes(v)) temas.push(v);
            });
          }
          break;
        }
      }
    }
  } catch (e) {}

  return [...new Set(temas)].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

async function fetchTemasPublico() {
  const emptyMeta = { htmlLength: 0, hasFbPublic: false };
  try {
    const r = await fetch(`${FORMS_VIEW}?cb=${Date.now()}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
      cf: { cacheTtl: 0, cacheEverything: false }
    });
    if (r.status !== 200) {
      return { temas: [], httpStatus: r.status, bloqueadoPorLogin: false, ...emptyMeta };
    }
    const html = await r.text();
    const bloqueadoPorLogin =
      html.includes('Google Forms: Sign-in') ||
      html.includes('to continue to Google Forms');
    const hasFbPublic = html.includes('FB_PUBLIC_LOAD_DATA_');
    const temas = extrairTemasDoHtml(html);
    return {
      temas,
      httpStatus: r.status,
      bloqueadoPorLogin,
      htmlLength: html.length,
      hasFbPublic,
    };
  } catch (e) {
    return { temas: [], httpStatus: 0, bloqueadoPorLogin: false, ...emptyMeta };
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    }
  });
}

function debugPayload(fetched, meta, synced) {
  return {
    httpStatus: meta.httpStatus,
    bloqueadoPorLogin: meta.bloqueadoPorLogin,
    hasFbPublic: meta.hasFbPublic,
    htmlLength: meta.htmlLength,
    temaCount: fetched.length,
    synced: synced === true,
  };
}

export async function onRequestGet({ env, request }) {
  const url = new URL(request.url);
  const refresh = url.searchParams.get('refresh') === '1';
  const wantDebug = url.searchParams.get('debug') === '1';

  if (refresh) {
    const {
      temas: fetched,
      httpStatus,
      bloqueadoPorLogin,
      htmlLength,
      hasFbPublic,
    } = await fetchTemasPublico();

    const meta = { httpStatus, bloqueadoPorLogin, htmlLength, hasFbPublic };

    if (env.DB) {
      try {
        await garantirTabela(env.DB);
        if (fetched.length > 0) {
          await substituirTemas(env.DB, fetched);
          const temas = await listar(env.DB);
          const out = { temas, total: temas.length, synced: true, httpStatus, bloqueadoPorLogin: false };
          if (wantDebug) out.debug = debugPayload(fetched, meta, true);
          return json(out);
        }
        let temas = await listar(env.DB);
        if (temas.length === 0) {
          await semear(env.DB);
          temas = await listar(env.DB);
        }
        const out = {
          temas,
          total: temas.length,
          synced: false,
          httpStatus,
          bloqueadoPorLogin,
          warning: bloqueadoPorLogin
            ? 'Google Forms exigiu login. Mantivemos a lista salva localmente.'
            : 'Não foi possível ler os temas no formulário; mantendo lista salva.',
        };
        if (wantDebug) out.debug = debugPayload(fetched, meta, false);
        return json(out);
      } catch (e) {
        const out = {
          temas: NOMES_PADRAO,
          total: NOMES_PADRAO.length,
          synced: false,
          bloqueadoPorLogin,
          error: e.message
        };
        if (wantDebug) out.debug = debugPayload(fetched, meta, false);
        return json(out);
      }
    }

    if (fetched.length > 0) {
      const out = { temas: fetched, total: fetched.length, synced: true, httpStatus, bloqueadoPorLogin: false };
      if (wantDebug) out.debug = debugPayload(fetched, meta, true);
      return json(out);
    }
    const out = {
      temas: NOMES_PADRAO,
      total: NOMES_PADRAO.length,
      synced: false,
      httpStatus,
      bloqueadoPorLogin,
      warning: bloqueadoPorLogin
        ? 'Google Forms exigiu login. Mantivemos a lista padrão.'
        : 'Não foi possível ler os temas no formulário.'
    };
    if (wantDebug) out.debug = debugPayload(fetched, meta, false);
    return json(out);
  }

  if (!env.DB) return json({ temas: NOMES_PADRAO, total: NOMES_PADRAO.length });
  try {
    await garantirTabela(env.DB);
    let temas = await listar(env.DB);
    if (temas.length === 0) {
      await semear(env.DB);
      temas = await listar(env.DB);
    }
    return json({ temas, total: temas.length });
  } catch (e) {
    return json({ temas: NOMES_PADRAO, total: NOMES_PADRAO.length });
  }
}

export async function onRequestPost({ env, request }) {
  if (!env.DB) return json({ error: 'DB not configured' }, 500);
  try {
    const body = await request.json();
    const { action } = body;
    await garantirTabela(env.DB);

    if (action === 'sync') {
      const { token } = body;
      if (!token) return json({ error: 'Token necessário' }, 400);
      const { temas: temasSync, httpStatus } = await fetchTemasComToken(token);
      let synced = false;
      if (temasSync.length > 0) {
        const stmt = env.DB.prepare('INSERT OR IGNORE INTO temas (nome) VALUES (?)');
        await env.DB.batch(temasSync.map(n => stmt.bind(n)));
        synced = true;
      }
      const temas = await listar(env.DB);
      return json({ temas, total: temas.length, synced, httpStatus });

    } else if (action === 'add') {
      const n = (body.nome || '').trim();
      if (!n) return json({ error: 'Nome inválido' }, 400);
      await env.DB.prepare('INSERT OR IGNORE INTO temas (nome) VALUES (?)').bind(n).run();

    } else if (action === 'remove') {
      const n = (body.nome || '').trim();
      if (!n) return json({ error: 'Nome inválido' }, 400);
      await env.DB.prepare('DELETE FROM temas WHERE nome = ?').bind(n).run();

    } else if (action === 'importHtml') {
      const html = body.html;
      if (typeof html !== 'string' || html.trim().length === 0) {
        return json({ error: 'Cole o HTML (código-fonte da página do Forms).' }, 400);
      }
      const maxLen = 2_000_000;
      if (html.length > maxLen) return json({ error: 'HTML excede o limite permitido.' }, 400);
      const nomes = extrairTemasDoHtml(html);
      if (nomes.length === 0) {
        return json({
          error: 'Nenhum tema encontrado. O HTML precisa conter FB_PUBLIC_LOAD_DATA_ com o campo Tema (mesma página que você vê logado no Forms).',
        }, 400);
      }
      await substituirTemas(env.DB, nomes);
      const temas = await listar(env.DB);
      return json({
        temas,
        total: temas.length,
        synced: true,
        imported: true,
        temaCount: nomes.length,
      });

    } else {
      return json({ error: 'Ação inválida' }, 400);
    }

    const temas = await listar(env.DB);
    return json({ temas, total: temas.length });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

async function fetchTemasComToken(token) {
  try {
    const r = await fetch(FORMS_VIEW, {
      headers: {
        'Authorization': 'Bearer ' + token,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      cf: { cacheTtl: 0, cacheEverything: false }
    });
    if (r.status !== 200) return { temas: [], httpStatus: r.status };
    const html = await r.text();
    const temas = extrairTemasDoHtml(html);
    return { temas, httpStatus: 200 };
  } catch(e) {
    return { temas: [], httpStatus: 0 };
  }
}
