# Portal do Fornecedor — Capital da Lingerie

Portal onde cada fornecedor registra pedidos e vê **apenas os produtos dele**.
Custo definido pela Capital (importado de fora e travado); total calculado
automaticamente; registro de ciência dos valores.

**Stack:** Next.js (App Router) · Supabase (Postgres + Auth + RLS) · Vercel.

## Setup local

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Crie o projeto no Supabase e rode o SQL:
   - No **SQL Editor**, cole e execute `supabase/migrations/0001_init.sql`.
   - (Opcional, para testar) execute `supabase/seed.sql`.

3. Copie as chaves para o ambiente:

   ```bash
   cp .env.example .env.local
   ```

   Preencha `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e
   `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API).

4. Rode:

   ```bash
   npm run dev
   ```

## Criar um acesso de fornecedor (feito pela Sewe/Capital)

1. **Authentication → Users → Add user** (e-mail + senha).
2. Copie o UUID do usuário e vincule ao fornecedor no SQL Editor:

   ```sql
   insert into fornecedor_usuarios (user_id, fornecedor_id)
   values ('<UUID-DO-USUARIO>', '<UUID-DO-FORNECEDOR>');
   ```

Ao logar, o usuário vê somente os produtos e pedidos daquele fornecedor
(garantido por Row Level Security no banco).

## Arquitetura de dados

- **Fonte da verdade:** Postgres (Supabase).
- **Entrada:** custo dos produtos é importado de fora (planilha/ERP/Drive) e
  gravado apenas via `service_role` — o fornecedor nunca edita.
- **Saída (BI / Full Screen):** camada de exportação plugável (CSV no Drive,
  view/API ou conexão direta) — definida após validação técnica com o Welligton.

## Deploy (Vercel)

1. Importe o repositório do GitHub na Vercel.
2. Configure as mesmas variáveis de ambiente do `.env.local`.
3. Cada push na branch principal gera deploy automático.
