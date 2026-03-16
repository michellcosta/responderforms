const FORMS_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSd5UX3FbvMhitt9M8YmAunUFzVW7g7zALSdvMXbJJbt_NOaoQ/viewform';
const TEMA_ENTRY_ID = 976109499;

const TEMAS_FALLBACK = [
  'Segurança no período de férias',
  'Cuidados em Periodo de Chuva',
  'Condições Adversas - Raios',
  'Regras de Segurança',
  "EPI'S & Adornos",
  'Risco com Celular',
  'Campanha Trajeto Seguro - Trajeto',
  'Campanha Pátio + Seguro'
];

function extrairTemas(html) {
  const temas = [];
  const excluir = ['Briefing Safety OTR', 'E-mail', 'Nome Completo', 'Escolher', 'Choose'];

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

export async function onRequestGet(context) {
  try {
    let temas = [];
    const response = await fetch(FORMS_URL + '?cb=' + Date.now(), {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const html = await response.text();
    if (html.includes('FB_PUBLIC_LOAD_DATA_')) {
      temas = extrairTemas(html);
    }
    if (temas.length === 0) temas = TEMAS_FALLBACK;

    return new Response(JSON.stringify({ temas, total: temas.length }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ temas: TEMAS_FALLBACK, total: TEMAS_FALLBACK.length }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
