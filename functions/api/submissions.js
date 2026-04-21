const FORMS_VIEW = 'https://docs.google.com/forms/d/e/1FAIpQLSd5UX3FbvMhitt9M8YmAunUFzVW7g7zALSdvMXbJJbt_NOaoQ/viewform';

function getHidden(html, name) {
  const m = new RegExp(`name="${name}"\\s+value="([^"]*)"`, 'i').exec(html)
          || new RegExp(`value="([^"]*)"[^>]*name="${name}"`, 'i').exec(html);
  return m ? m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&') : '';
}

async function enviarGoogleForms({ nome, email, cargo, empresa, tema, op, site }) {
  try {
    const pageRes = await fetch(FORMS_VIEW, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const html = await pageRes.text();

    const actionMatch = html.match(/action="(https:\/\/docs\.google\.com[^"]+formResponse)"/);
    const action = actionMatch ? actionMatch[1] : FORMS_VIEW.replace('viewform', 'formResponse');

    const fd = new FormData();
    fd.append('entry.859537025', email);
    fd.append('entry.305174092', nome);
    fd.append('entry.1530674274', cargo || '');
    fd.append('entry.170197194', empresa || '');
    fd.append('entry.976109499', tema || '');
    fd.append('entry.987323929', '');
    fd.append('entry.2004173578', op || '');
    fd.append('entry.2067716336', site || '');
    fd.append('entry.1605377415', '');
    fd.append('fvv', '1');
    fd.append('pageHistory', '0');
    fd.append('fuIds', getHidden(html, 'fuIds') || '666207489');
    fd.append('submissionTimestamp', '-1');
    fd.append('fbzx', getHidden(html, 'fbzx'));
    fd.append('token', getHidden(html, 'token'));
    fd.append('tag', getHidden(html, 'tag'));
    fd.append('partialResponse', getHidden(html, 'partialResponse'));

    const cookies = pageRes.headers.get('set-cookie') || '';
    const submitRes = await fetch(action, {
      method: 'POST',
      body: fd,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': FORMS_VIEW,
        'Origin': 'https://docs.google.com',
        ...(cookies ? { Cookie: cookies } : {}),
      },
    });
    return submitRes.status;
  } catch (e) {
    return 0;
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  });
}

export async function onRequestGet(context) {
  const { env } = context;
  if (!env.DB) return jsonResponse({ submissions: [] });
  try {
    // Apenas submissões do dia (horário de Brasília)
    const now = new Date();
    const todayBR = now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const startUTC = `${todayBR} 03:00:00`; // 00:00 BRT = 03:00 UTC
    const [y, m, d] = todayBR.split('-').map(Number);
    const tomorrowStr = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
    const endUTC = `${tomorrowStr} 02:59:59`; // 23:59:59 BRT = 02:59:59 UTC dia seguinte

    const r = await env.DB.prepare(
      `SELECT nome, email, time FROM submissions 
       WHERE created_at >= ? AND created_at <= ? 
       ORDER BY created_at ASC`
    ).bind(startUTC, endUTC).all();

    const submissions = (r.results || []).map(s => ({
      nome: s.nome,
      email: s.email,
      time: s.time
    }));
    return jsonResponse({ submissions });
  } catch (e) {
    return jsonResponse({ submissions: [], error: e.message });
  }
}

export async function onRequestPost(context) {
  const { env, request } = context;
  if (!env.DB) return jsonResponse({ error: 'DB not configured' }, 500);
  try {
    const body = await request.json();
    const { nome, email, cargo, empresa, tema, op, site } = body;
    if (!nome || !email) return jsonResponse({ error: 'Nome e email obrigatórios' }, 400);

    const now = new Date();
    const opts = { timeZone: 'America/Sao_Paulo' };
    const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', ...opts })
      + ' · ' + now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', ...opts });

    await env.DB.prepare(
      'INSERT INTO submissions (nome, email, time) VALUES (?, ?, ?)'
    ).bind(nome, email, time).run();

    enviarGoogleForms({ nome, email, cargo, empresa, tema, op, site });

    return jsonResponse({ ok: true, nome, email, tema: tema || '', time });
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
