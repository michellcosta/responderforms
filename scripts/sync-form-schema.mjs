import { readFile, writeFile } from 'node:fs/promises';
import vm from 'node:vm';

const CONFIG_PATH = new URL('../config.js', import.meta.url);
const SCHEMA_PATH = new URL('../form-schema.json', import.meta.url);

function extractFormId(configText) {
  const match = configText.match(/formId:\s*"([^"]+)"/);
  return match?.[1] ?? null;
}

function mapType(typeCode) {
  const map = {
    0: 'short_text',
    1: 'paragraph',
    2: 'multiple_choice',
    3: 'dropdown',
    4: 'checkbox',
  };
  return map[typeCode] || 'unknown';
}

function parseLoadData(html) {
  const match = html.match(/FB_PUBLIC_LOAD_DATA_\s*=\s*(\[.*?\]);\s*<\/script>/s);
  if (!match) {
    throw new Error('FB_PUBLIC_LOAD_DATA_ não encontrado no HTML do Forms.');
  }

  const payload = vm.runInNewContext(match[1]);
  const questions = payload?.[1]?.[1];
  if (!Array.isArray(questions)) {
    throw new Error('Estrutura de questões não encontrada em FB_PUBLIC_LOAD_DATA_.');
  }

  return questions
    .map((question) => {
      const label = question?.[1] || '';
      const typeCode = question?.[3];
      const answerBlock = question?.[4]?.[0];
      const entryId = answerBlock?.[0] ? `entry.${answerBlock[0]}` : null;
      const optionsRaw = answerBlock?.[1];

      if (!entryId) return null;

      const options = Array.isArray(optionsRaw)
        ? optionsRaw.map((item) => item?.[0]).filter(Boolean)
        : [];

      return {
        entryId,
        label,
        type: mapType(typeCode),
        options,
      };
    })
    .filter(Boolean);
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
  const fields = parseLoadData(html);

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
