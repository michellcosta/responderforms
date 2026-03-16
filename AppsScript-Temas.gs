/**
 * Apps Script para Briefing Safety - Buscar temas do Google Forms
 *
 * INSTRUÇÕES:
 * 1. Abra seu formulário no Google Forms e clique em "Editar"
 * 2. Na barra de endereços, copie o ID (entre /d/ e /edit)
 *    Ex: https://docs.google.com/forms/d/1ABC123xyz/edit  → ID = 1ABC123xyz
 * 3. Cole o ID na variável FORM_ID abaixo
 * 4. Cole TODO este código no Apps Script (script.google.com)
 * 5. Salve (Ctrl+S)
 * 6. Clique em "Executar" (▶️) e AUTORIZE quando o Google pedir
 * 7. Implantar > Gerenciar implantações > Editar > Nova versão > Implantar
 */

// COLOQUE AQUI O ID DO FORMULÁRIO (da URL de edição: /d/XXXXX/edit)
var FORM_ID = '1FAIpQLSd5UX3FbvMhitt9M8YmAunUFzVW7g7zALSdvMXbJJbt_NOaoQ';

function doGet() {
  var temas = [];

  // 1. Tenta FormApp (acesso direto - mais confiável)
  try {
    var form = FormApp.openById(FORM_ID);
    var items = form.getItems();
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (item.getTitle().toLowerCase().indexOf('tema') !== -1) {
        var choices = [];
        if (item.getType() == FormApp.ItemType.LIST) {
          choices = item.asListItem().getChoices();
        } else if (item.getType() == FormApp.ItemType.MULTIPLE_CHOICE) {
          choices = item.asMultipleChoiceItem().getChoices();
        }
        if (choices.length > 0) {
          temas = choices.map(function(c) { return c.getValue(); });
          break;
        }
      }
    }
  } catch (e) {
    // FormApp falhou (ex: ID errado ou falta autorização) → tenta UrlFetchApp
    temas = fetchViaUrl();
  }

  return ContentService
    .createTextOutput(JSON.stringify({ temas: temas, total: temas.length }))
    .setMimeType(ContentService.MimeType.JSON);
}

function fetchViaUrl() {
  var url = 'https://docs.google.com/forms/d/e/1FAIpQLSd5UX3FbvMhitt9M8YmAunUFzVW7g7zALSdvMXbJJbt_NOaoQ/viewform';
  var temas = [];
  try {
    var html = UrlFetchApp.fetch(url, { muteHttpExceptions: true }).getContentText();
    var fbMatch = html.match(/FB_PUBLIC_LOAD_DATA_\s*=\s*(\[[\s\S]+?\]);\s*<\/script>/);
    if (fbMatch) {
      var re = /\["([^"\\\[\]]+)",\s*null,\s*null,\s*null,\s*(?:null|\d+)\]/g;
      var m;
      while ((m = re.exec(fbMatch[1])) !== null) {
        var val = m[1].trim();
        if (val.length > 2 && val !== "Briefing Safety OTR" && val !== "E-mail" && val !== "Nome Completo" && val.indexOf("http") === -1) {
          temas.push(val);
        }
      }
    }
    if (temas.length === 0) {
      var reHtml = /data-value="([^"]+)"/g;
      var mh;
      while ((mh = reHtml.exec(html)) !== null) {
        var v = mh[1].trim();
        if (v && v.length > 1 && v !== "Briefing Safety OTR") temas.push(v);
      }
    }
    temas = temas.filter(function(item, pos) { return temas.indexOf(item) === pos; }).sort();
  } catch (e) {}
  return temas;
}
