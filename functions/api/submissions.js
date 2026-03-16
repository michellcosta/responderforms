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
    const r = await env.DB.prepare(
      'SELECT nome, email, time, created_at FROM submissions ORDER BY created_at ASC'
    ).all();
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
    const { nome, email } = body;
    if (!nome || !email) return jsonResponse({ error: 'Nome e email obrigatórios' }, 400);

    const now = new Date();
    const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      + ' · ' + now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

    await env.DB.prepare(
      'INSERT INTO submissions (nome, email, time) VALUES (?, ?, ?)'
    ).bind(nome, email, time).run();

    return jsonResponse({ ok: true, time });
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
