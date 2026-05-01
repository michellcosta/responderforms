/**
 * Apps Script - Briefing Safety OTR
 * Busca temas usando autenticação OAuth da conta Google do script owner.
 *
 * IMPORTANTE: Ao implantar, autorize TODOS os escopos pedidos pelo Google.
 */

var FORMS_URL  = 'https://docs.google.com/forms/d/e/1FAIpQLSd5UX3FbvMhitt9M8YmAunUFzVW7g7zALSdvMXbJJbt_NOaoQ/viewform';
var EXCLUIR    = ['Briefing Safety OTR', 'E-mail', 'Nome Completo', 'Escolher', 'Choose'];
var TEMA_ENTRY = 976109499;

function doGet() {
  var temas = buscarTemas();
  return ContentService
    .createTextOutput(JSON.stringify({ temas: temas, total: temas.length, ok: temas.length > 0 }))
    .setMimeType(ContentService.MimeType.JSON);
}

function buscarTemas() {
  // 1. Tenta com token OAuth (acesso autenticado)
  var temas = fetchComAuth();
  if (temas.length > 0) return temas;

  // 2. Tenta sem autenticação
  temas = fetchSemAuth();
  return temas;
}

function fetchComAuth() {
  try {
    var token = ScriptApp.getOAuthToken();
    var resp = UrlFetchApp.fetch(FORMS_URL, {
      muteHttpExceptions: true,
      headers: {
        'Authorization': 'Bearer ' + token,
        'User-Agent': 'Mozilla/5.0 (compatible; GoogleScript/1.0)',
        'Accept': 'text/html,*/*'
      }
    });
    if (resp.getResponseCode() === 200) {
      return parseTemas(resp.getContentText());
    }
  } catch(e) {}
  return [];
}

function fetchSemAuth() {
  try {
    var resp = UrlFetchApp.fetch(FORMS_URL, {
      muteHttpExceptions: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,*/*',
        'Accept-Language': 'pt-BR,pt;q=0.9'
      }
    });
    if (resp.getResponseCode() === 200) {
      return parseTemas(resp.getContentText());
    }
  } catch(e) {}
  return [];
}

function parseTemas(html) {
  var temas = [];
  if (!html || html.indexOf('FB_PUBLIC_LOAD_DATA_') === -1) return temas;

  // Extrai o JSON completo balanceando colchetes
  var idx = html.indexOf('FB_PUBLIC_LOAD_DATA_');
  var start = html.indexOf('[', idx);
  if (start === -1) return temas;

  var depth = 0, inStr = false, esc = false, jsonStr = '';
  for (var i = start; i < html.length; i++) {
    var c = html[i];
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
    var data = JSON.parse(jsonStr);
    var campos = data[1] && data[1][1];
    if (Array.isArray(campos)) {
      for (var f = 0; f < campos.length; f++) {
        var campo = campos[f];
        // Busca pelo Entry ID do campo Tema
        if (campo[4] && campo[4][0] && campo[4][0][0] === TEMA_ENTRY) {
          var opts = campo[4][0][1];
          if (Array.isArray(opts)) {
            opts.forEach(function(opt) {
              var v = opt[0];
              if (v && typeof v === 'string' && EXCLUIR.indexOf(v) === -1) temas.push(v);
            });
            return temas;
          }
        }
      }
    }
  } catch(e) {}

  // Fallback regex
  var re = /\["([^"\\\[\]]{3,})",null,null,null,(?:null|\d+)\]/g;
  var m;
  while ((m = re.exec(html)) !== null) {
    var val = m[1].trim();
    if (EXCLUIR.indexOf(val) === -1 && val.indexOf('http') === -1) temas.push(val);
  }
  return temas.filter(function(v, i) { return temas.indexOf(v) === i; });
}

// Rode esta função para debugar
function debug() {
  var token = ScriptApp.getOAuthToken();
  var resp = UrlFetchApp.fetch(FORMS_URL, {
    muteHttpExceptions: true,
    headers: { 'Authorization': 'Bearer ' + token }
  });
  Logger.log('Status: ' + resp.getResponseCode());
  Logger.log('Tem FB_PUBLIC_LOAD_DATA_: ' + (resp.getContentText().indexOf('FB_PUBLIC_LOAD_DATA_') !== -1));
  Logger.log('Temas: ' + JSON.stringify(buscarTemas()));
}
