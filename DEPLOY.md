# Deploy no Cloudflare Pages + D1

## 1. Deploy inicial (sem D1)

O deploy deve funcionar. O `/api/temas` funciona sem banco. Para session e submissions, configure o D1 abaixo.

## 2. Criar o banco D1 (no dashboard)

1. Acesse [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **D1**
2. **Create database** → Nome: `responderforms-db`
3. **Create**

## 3. Vincular D1 ao projeto Pages

1. **Workers & Pages** → **responderforms** (seu projeto)
2. **Settings** → **Functions** → **D1 database bindings**
3. **Add binding** → Variable name: `DB` → D1 database: `responderforms-db`
4. **Save**

## 4. Executar o schema

No terminal (com `wrangler login` feito):

```bash
npx wrangler d1 execute responderforms-db --file=./schema.sql --remote
```

## 5. Deploy no Cloudflare

### Opção A: Via Git (recomendado)

1. Acesse [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages**
2. **Create** → **Pages** → **Connect to Git**
3. Conecte o repositório `michellcosta/responderforms`
4. **Build settings:**
   - Build command: *(deixe vazio)*
   - Build output directory: `/`
5. Em **Settings** → **Functions** → **D1 database bindings**:
   - Variable name: `DB`
   - D1 database: `responderforms-db`
6. **Save** e **Deploy**

### Opção B: Via Wrangler (CLI)

```bash
npm install -g wrangler
wrangler login
wrangler pages deploy . --project-name=responderforms
```

## 5. Variáveis e bindings

No dashboard do projeto Pages → **Settings** → **Functions**:
- Adicione o binding D1: `DB` → `responderforms-db`

## URLs das APIs

- `GET /api/temas` — Lista de temas
- `GET /api/session` — Sessão ativa
- `POST /api/session` — Salvar sessão (admin)
- `GET /api/submissions` — Lista de envios
- `POST /api/submissions` — Registrar envio
