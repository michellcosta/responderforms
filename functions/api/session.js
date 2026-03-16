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
  if (!env.DB) {
    return jsonResponse({ error: 'DB not configured' }, 500);
  }
  try {
    const r = await env.DB.prepare('SELECT cargo, empresa, tema, op, site, at FROM session WHERE id = 1').first();
    const data = r ? { cargo: r.cargo, empresa: r.empresa, tema: r.tema, op: r.op, site: r.site, at: r.at } : null;
    return jsonResponse({ session: data });
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
}

export async function onRequestPost(context) {
  const { env, request } = context;
  if (!env.DB) return jsonResponse({ error: 'DB not configured' }, 500);
  try {
    const body = await request.json();
    const { cargo, empresa, tema, op, site } = body;
    if (!cargo || !empresa || !tema || !op || !site) {
      return jsonResponse({ error: 'Campos obrigatórios' }, 400);
    }
    const at = new Date().toISOString();
    await env.DB.prepare(
      'UPDATE session SET cargo=?, empresa=?, tema=?, op=?, site=?, at=? WHERE id=1'
    ).bind(cargo, empresa, tema, op, site, at).run();
    return jsonResponse({ ok: true, session: { cargo, empresa, tema, op, site, at } });
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}
