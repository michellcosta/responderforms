import { readFile, writeFile } from 'node:fs/promises';

const CONFIG_PATH = new URL('../config.js', import.meta.url);
const SCHEMA_PATH = new URL('../form-schema.json', import.meta.url);

function extractFormId(configText) {
  const match = configText.match(/formId:\s*"([^"]+)"/);
  return match?.[1] ?? null;
}

function stripHtml(value) {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
}

async function main() {
  const configText = await readFile(CONFIG_PATH, 'utf8');
  const formId = extractFormId(configText);

  if (!formId) {
    throw new Error('Não foi possível localizar formId em config.js');
  }

  const formUrl = `https://docs.google.com/forms/d/e/${formId}/viewform`;
  const response = await fetch(formUrl, {
    headers: {
      'user-agent': 'responderforms-schema-sync/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Falha ao baixar form: HTTP ${response.status}`);
  }

  const html = await response.text();

  const entryMatches = [...html.matchAll(/name="(entry\.\d+)"/g)].map((m) => m[1]);
  const uniqueEntryIds = [...new Set(entryMatches)];

  const headingMatches = [...html.matchAll(/<div[^>]*role="heading"[^>]*>([\s\S]*?)<\/div>/g)].map((m) => stripHtml(m[1]));

  const fields = uniqueEntryIds.map((entryId, index) => ({
    entryId,
    label: headingMatches[index] || entryId,
  }));

  const schema = {
    generatedAt: new Date().toISOString(),
    formId,
    sourceUrl: formUrl,
    fields,
  };

  await writeFile(SCHEMA_PATH, `${JSON.stringify(schema, null, 2)}\n`);
  console.log(`Schema atualizado com ${fields.length} campos.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
