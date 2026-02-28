# Responder Forms

Mini site para enviar respostas ao Google Forms com apenas **nome** e **email**, mantendo respostas fixas configuradas pelo admin.

## O que foi adicionado

- Usuário: nome e email ficam salvos no navegador (`localStorage`) após preencher/enviar.
- Usuário recorrente: quando abrir novamente, os dados são carregados e ele pode clicar direto em **Enviar**.
- Admin: pode alterar qualquer resposta fixa no navegador abrindo a página com `?admin=1`.

## Como funciona

1. O admin pega o `formId` do Google Forms e configura em `config.js`.
2. O admin mapeia quais `entry.<id>` serão:
   - `nameEntryId` (campo nome)
   - `emailEntryId` (campo email)
   - `fixedAnswers` (respostas pré-definidas invisíveis para usuário)
3. O usuário abre `index.html`, preenche nome/email e envia.
4. O site envia um `POST` para `https://docs.google.com/forms/d/e/<FORM_ID>/formResponse`.

## Estrutura

- `index.html`: interface do usuário + painel admin (modo `?admin=1`).
- `styles.css`: estilo básico.
- `config.js`: configuração do formulário e respostas fixas.
- `app.js`: validação, persistência local e envio.

## Configuração

Edite `config.js`:

```js
window.FORM_CONFIG = {
  formId: "SEU_FORM_ID_AQUI",
  nameEntryId: "entry.123456789",
  emailEntryId: "entry.987654321",
  fixedAnswers: {
    "entry.111111111": "Resposta fixa 1",
    "entry.222222222": "Resposta fixa 2"
  }
};
```

### Como descobrir os `entry.<id>`

Use um link de **formulário pré-preenchido** do Google Forms:

- No Google Forms, abra o menu de três pontos → **Receber link pré-preenchido**.
- Preencha respostas de teste e gere o link.
- No link final, cada parâmetro `entry.<id>=valor` representa um campo.
- Copie os IDs para `config.js`.


## IDs já mapeados do seu formulário

Com base no link enviado, os campos são:

- `entry.859537025` → **E-mail**
- `entry.305174092` → **Nome Completo**
- `entry.987323929` → Cargo / Função
- `entry.1605377415` → Empresa
- `entry.1530674274` → Tema
- `entry.170197194` → Qual sua opinião sobre o tema?
- `entry.976109499` → Operação
- `entry.2004173578` → Site (Localidade)
- `entry.2067716336` → Se você respondeu OUTROS...

> Atenção: os valores padrão em `fixedAnswers` no `config.js` são exemplos.
> Para perguntas de múltipla escolha, troque pelo texto exato de uma opção do seu Google Forms.

## Modo admin (alterar respostas fixas)

Abra a página com `?admin=1`.

Exemplo local:

- `http://localhost:4173/?admin=1`

Nesse modo, todas as respostas de `fixedAnswers` aparecem para edição e ficam salvas no navegador do admin.

- O botão **Trocar usuário** foi substituído por **Login admin**.
- Credenciais fixas do admin:
  - login: `admin`
  - senha: `admin123`
- Sem login admin válido, `?admin=1` não abre o painel.

- No modo admin (`?admin=1`), a área de usuário (Nome/Email/Enviar/Trocar usuário) fica oculta.
- Ao clicar em **Salvar respostas fixas**, aparece a confirmação `Respostas fixas do admin salvas com sucesso.` abaixo do botão.

### Ler estrutura do Forms automaticamente (labels dos campos)

Este projeto agora mantém um `form-schema.json` com os campos do Google Forms.
No painel admin, os campos aparecem com o nome da pergunta (não só `entry.xxxxx`).

- Sincronização manual local:

```bash
npm run sync:schema
```

- Sincronização automática no GitHub:
  - workflow `Sync Google Form schema` roda a cada 6 horas e atualiza `form-schema.json`.

> Se o Google bloquear acesso no seu ambiente local, rode apenas no GitHub Actions (lá costuma funcionar melhor).

### Escolher valores exatamente como no Google Forms

### Padrões já configurados neste projeto

- Empresa: `DELUNA`
- Qual sua opinião sobre o tema?: vazio
- Se você respondeu OUTROS...: vazio
- Operação: opções corretas carregadas do Forms
- Site (Localidade): `SRJ8_Niterói (Itaboraí)`
- Tema: menu com as 5 últimas respostas

- Quando o `form-schema.json` contém `options`, o admin vê **textarea + menu de respostas**.
- O admin escolhe no menu e o texto é copiado automaticamente para o textarea do campo.
- Assim você mantém edição manual quando quiser, mas com opção de selecionar exatamente o texto do Forms.
- O arquivo `form-schema.json` de exemplo pode vir com lista resumida em alguns campos muito grandes (como Empresa/Site).
- Para carregar a lista completa diretamente do Forms, rode `npm run sync:schema` ou o workflow **Sync Google Form schema**.
- Para atualizar automaticamente quando o Forms mudar:

```bash
npm run sync:schema
```

ou rode o workflow **Sync Google Form schema** no GitHub Actions.

## Publicar no GitHub Pages (recomendado)

1. Suba este projeto para um repositório no GitHub.
2. No GitHub, vá em **Settings → Pages** e selecione **GitHub Actions** como source.
3. Faça push para a branch (`main`, `master` ou `work`) e aguarde o workflow `Deploy static site to GitHub Pages`.
4. O site ficará disponível em uma URL como:
   - `https://SEU-USUARIO.github.io/NOME-DO-REPO/`

> Depois de publicado, você não precisa usar `localhost`.

## Se o link do Pages continuar em 404

Faça estes passos no GitHub (uma vez):

1. **Settings → Pages**
2. Em **Build and deployment / Source**, escolha **Deploy from a branch**
3. Em **Branch**, selecione **`gh-pages`** e pasta **`/ (root)`**
4. Salve
5. Vá na aba **Actions** e rode o workflow **"Deploy to gh-pages branch (fallback)"**
6. Aguarde 1–3 minutos e abra:
   - `https://michellcosta.github.io/responderforms/`

Esse fluxo fallback evita dependência do modo "GitHub Actions" do Pages e costuma resolver 404 persistente.

## Executar localmente

Use um dos jeitos abaixo:

### Opção 1 (recomendada): Node.js

```bash
npm start
```

Depois acesse: `http://localhost:4173`.

### Opção 2: Python

```bash
python3 -m http.server 4173
```

Depois acesse: `http://localhost:4173`.


### Opção 3: Windows (duplo clique)

- Clique duas vezes no arquivo `start.bat`.
- O servidor vai iniciar e mostrar `http://localhost:4173` no terminal.
- Abra esse endereço no navegador.

> Se abrir `http://localhost:4173` sem iniciar um servidor antes, não vai funcionar.

## Observações

- A submissão usa `fetch` com `no-cors` para funcionar melhor em hospedagem estática (incluindo GitHub Pages).
- Este modelo é ideal para facilitar o envio.
- Não é uma barreira de segurança absoluta: quem conhecer os IDs ainda pode tentar enviar manualmente ao endpoint do Forms.
- Para maior controle (anti-spam, validação forte, bloqueio de duplicidade), use backend intermediário.
