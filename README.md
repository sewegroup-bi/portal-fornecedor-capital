# Portal do Fornecedor — Capital da Lingerie

Portal onde cada fornecedor registra pedidos vendo **apenas os produtos dele**, com
custo definido pela Capital (importado do ERP e somente leitura), total calculado
automaticamente e registro formal de ciência dos valores.

O catálogo é sincronizado **automaticamente de hora em hora** a partir do arquivo que
o ERP publica no Google Drive.

> 📐 Decisões de arquitetura, princípios e armadilhas conhecidas: **[ARQUITETURA.md](ARQUITETURA.md)**.
> Leia antes de mexer em RLS, importação ou saída de dados.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Aplicação | Next.js 15 (App Router) + TypeScript |
| Banco / Auth | Supabase (Postgres + Auth + Row Level Security) |
| Hospedagem / Cron | Vercel (plano Pro — o cron de hora em hora exige Pro) |
| E-mail transacional | Resend, via SMTP customizado do Supabase |
| Entrada de dados | Google Drive (conta de serviço, somente leitura) |

## Estrutura

```
src/
├─ app/
│  ├─ login/                 tela de login
│  ├─ definir-senha/         primeira senha (vindo do convite por e-mail)
│  ├─ auth/confirm/          recebe o link do e-mail (convite / redefinição)
│  ├─ conta/                 "Minha conta": e-mail, perfil, trocar senha
│  ├─ pedidos/               portal do fornecedor (busca, pedido, histórico)
│  ├─ admin/                 painel: visão geral, importação, saída
│  │  ├─ acessos/            convidar / cortar / reativar acessos
│  │  └─ documentos/         relatório de documentos a corrigir no ERP
│  └─ api/
│     ├─ admin/importar      importação manual (admin)
│     ├─ admin/acessos       convite e corte de acesso
│     ├─ admin/saida         CSV da saída (download / Storage)
│     └─ cron/importar       importação automática (protegida por segredo)
├─ components/               componentes compartilhados
└─ lib/
   ├─ supabase/              clients (browser, server, service_role) + middleware
   ├─ google/drive.ts        leitura da pasta de ENTRADA
   ├─ import/                parser do CSV + rotina de importação
   └─ saida/                 geração do CSV de saída
supabase/migrations/         migrations numeradas (rodar em ordem)
```

---

## Setup local

```bash
npm install
```

1. **Banco:** no Supabase → **SQL Editor**, execute as migrations de
   `supabase/migrations/` **em ordem numérica** (`0001` → `0015`).
   Para dados de teste, execute também `supabase/seed.sql`.

2. **Variáveis:** copie `.env.example` para `.env.local` e preencha
   (Supabase → Project Settings → API):

   ```
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   SUPABASE_SERVICE_ROLE_KEY          # secreta — nunca no navegador
   GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 # chave da conta de serviço, em base64
   DRIVE_ENTRADA_FOLDER_ID            # pasta ENTRADA DE DADOS
   CRON_SECRET                        # protege /api/cron/importar
   ```

3. **Rodar:**

   ```bash
   npm run dev
   ```

### Verificações antes de commitar

```bash
npx tsc --noEmit && npx next build
```

---

## Configurações externas (uma vez)

### Google Drive (entrada de dados)
1. Google Cloud → ativar **Google Drive API**.
2. Criar **conta de serviço** (sem papéis/roles) e gerar **chave JSON**.
3. Converter a chave em base64 e colocar em `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`:

   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("$env:USERPROFILE\Downloads\chave.json")) | Set-Clipboard
   ```

4. Compartilhar a pasta **ENTRADA DE DADOS** com o e-mail da conta de serviço como
   **Leitor**.

> A conta de serviço tem escopo **somente leitura** de propósito. Escrever em pasta de
> "Meu Drive" não funciona com conta de serviço — ver ARQUITETURA.md.

### E-mail (Resend + Supabase)
1. Resend: domínio verificado + **API key** (Sending access).
2. Supabase → Authentication → Emails → **SMTP Settings**:
   `smtp.resend.com`, porta `465`, usuário `resend`, senha = API key.
3. Supabase → Authentication → **Rate Limits**: subir o limite de e-mails/hora
   (o padrão de 30/h não atende convite em lote).
4. Supabase → Authentication → **URL Configuration**:
   - Site URL: `https://portal-fornecedor-capital.vercel.app`
   - Redirect URLs: `https://portal-fornecedor-capital.vercel.app/auth/confirm`
5. Templates **Invite user** e **Reset password** devem apontar para:

   ```
   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite
   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery
   ```

---

## Operação do dia a dia

### Dar acesso a um fornecedor
`/admin/acessos` → busque o fornecedor → informe o e-mail (ou clique numa das
sugestões vindas do ERP) → **Convidar**. O fornecedor recebe um e-mail e cria a
própria senha. Um fornecedor pode ter **vários logins**.

### Cortar ou reativar acesso
`/admin/acessos` → **Cortar** / **Reativar** no login desejado. O corte tem efeito
imediato: o usuário continua conseguindo entrar, mas não vê nenhum dado.

### Tornar alguém administrador
```sql
insert into admin_usuarios (user_id)
values ('<UUID-DO-USUARIO>');
```

### Atualização do catálogo (entrada)
Roda **sozinha de hora em hora**. Se o arquivo do Drive não mudou, a execução é ignorada
(fica registrada como "nada novo"). Para forçar, use **Atualizar agora** em `/admin`
(card *Catálogo e custos*) — leva alguns minutos e grava uma linha no histórico.

### Dados dos pedidos (saída)
Em `/admin` → card *Dados dos pedidos*:
- **Baixar planilha** → CSV na hora (`GET /api/admin/saida`);
- **Gerar arquivo para o BI** → grava no Supabase Storage (bucket `saida`) e devolve link
  assinado de 1 ano.

O BI também pode ler direto a view `saida_pedidos`. Todo envio fica no histórico
(*Histórico de envios de dados*). O destino final depende da definição da Full Screen.

---

## Deploy

Push na `main` → a Vercel builda e publica. Variáveis de ambiente devem estar
configuradas em **Settings → Environment Variables** (as mesmas do `.env.local`).

O agendamento da importação está em `vercel.json` (`0 * * * *`).
