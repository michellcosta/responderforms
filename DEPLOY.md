# Deploy no Cloudflare Pages + D1

## 1. Criar o banco D1

```bash
npx wrangler d1 create responderforms-db
```

Copie o `database_id` da saída.

## 2. Atualizar wrangler.toml

Edite `wrangler.toml` e substitua `REPLACE_WITH_YOUR_D1_DATABASE_ID` pelo ID copiado.

## 3. Executar o schema

```bash
npx wrangler d1 execute responderforms-db --file=./schema.sql --remote
```

## 4. Deploy no Cloudflare

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
