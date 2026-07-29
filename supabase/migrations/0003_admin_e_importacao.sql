-- =============================================================
-- Fase: face interna (admin) + importação de produtos/custo do Drive
-- - colunas novas em fornecedores/produtos p/ bater com o fornecedores.csv
-- - conceito de admin (admin_usuarios + is_admin())
-- - log de importações
-- - policies de leitura para admin (vê tudo)
-- =============================================================

-- ---- colunas novas vindas do CSV ----
alter table fornecedores add column if not exists codigo_fabricante text;

alter table produtos add column if not exists codigo_produto_ref text; -- código embutido no campo "produto" (ex.: 0170076237)
alter table produtos add column if not exists ean text;                -- codigo_produto_fabricante (código de barras)
alter table produtos add column if not exists situacao text;           -- I / E

-- ---- admin ----
create table if not exists admin_usuarios (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);
alter table admin_usuarios enable row level security;

-- cada um vê só o próprio registro de admin (evita listar todos)
drop policy if exists admin_select_own on admin_usuarios;
create policy admin_select_own on admin_usuarios
  for select using (user_id = auth.uid());

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from admin_usuarios where user_id = auth.uid())
$$;

-- ---- log de importações ----
create table if not exists importacoes (
  id             uuid primary key default gen_random_uuid(),
  executado_por  uuid references auth.users(id) default auth.uid(),
  executado_em   timestamptz not null default now(),
  fonte          text,                 -- ex.: 'drive:fornecedores.csv'
  linhas_total   integer not null default 0,
  linhas_ok      integer not null default 0,
  linhas_erro    integer not null default 0,
  fornecedores_afetados integer not null default 0,
  detalhe        jsonb,                -- amostra de erros, etc.
  created_at     timestamptz not null default now()
);
alter table importacoes enable row level security;

drop policy if exists imp_admin_select on importacoes;
create policy imp_admin_select on importacoes
  for select using (is_admin());

-- ---- policies de leitura para admin (enxerga tudo; additivas ao RLS do fornecedor) ----
drop policy if exists forn_admin_select on fornecedores;
create policy forn_admin_select on fornecedores for select using (is_admin());

drop policy if exists prod_admin_select on produtos;
create policy prod_admin_select on produtos for select using (is_admin());

drop policy if exists ped_admin_select on pedidos;
create policy ped_admin_select on pedidos for select using (is_admin());

drop policy if exists pi_admin_select on pedido_itens;
create policy pi_admin_select on pedido_itens for select using (is_admin());
