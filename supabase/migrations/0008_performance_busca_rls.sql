-- =============================================================
-- PERFORMANCE (busca levava 6-8s e estourava statement timeout)
--
-- Causa 1: policies chamavam current_fornecedor_id()/is_admin() direto,
--   o que faz o Postgres executar a função UMA VEZ POR LINHA (105k vezes).
--   Envolver em (select ...) faz virar initPlan: roda uma vez por query.
--   (é o lint auth_rls_initplan da Supabase)
--
-- Causa 2: ilike com OR em 3 colunas não aproveita bem os índices.
--   Solução: uma coluna gerada "busca" (código + ref + nome) com um
--   único índice GIN trigram.
--
-- Também consolida policies duplicadas (fornecedor + admin) em uma só,
-- já que múltiplas policies permissivas são todas avaliadas.
-- =============================================================

-- ---------- 1) coluna de busca + índice único ----------
alter table produtos add column if not exists busca text
  generated always as (
    coalesce(codigo_fornecedor, '') || ' ' ||
    coalesce(codigo_produto_ref, '') || ' ' ||
    coalesce(nome, '')
  ) stored;

create index if not exists idx_produtos_busca_trgm
  on produtos using gin (busca gin_trgm_ops);

-- os índices por coluna não são mais necessários
drop index if exists idx_produtos_nome_trgm;
drop index if exists idx_produtos_codforn_trgm;
drop index if exists idx_produtos_ref_trgm;

-- ---------- 2) policies com (select ...) ----------

-- fornecedores
drop policy if exists forn_select_own   on fornecedores;
drop policy if exists forn_admin_select on fornecedores;
create policy forn_select on fornecedores for select using (
  (select is_admin()) or id = (select current_fornecedor_id())
);

-- vínculo usuário/fornecedor
drop policy if exists fu_select_own on fornecedor_usuarios;
create policy fu_select_own on fornecedor_usuarios for select using (
  user_id = (select auth.uid())
);

-- admin
drop policy if exists admin_select_own on admin_usuarios;
create policy admin_select_own on admin_usuarios for select using (
  user_id = (select auth.uid())
);

-- produtos (fornecedor vê os seus ativos; admin vê tudo) — sem escrita
drop policy if exists prod_select_own   on produtos;
drop policy if exists prod_admin_select on produtos;
create policy prod_select on produtos for select using (
  (select is_admin())
  or (ativo = true and fornecedor_id = (select current_fornecedor_id()))
);

-- pedidos
drop policy if exists ped_select_own   on pedidos;
drop policy if exists ped_admin_select on pedidos;
create policy ped_select on pedidos for select using (
  (select is_admin()) or fornecedor_id = (select current_fornecedor_id())
);

drop policy if exists ped_insert_own on pedidos;
create policy ped_insert_own on pedidos for insert with check (
  fornecedor_id = (select current_fornecedor_id())
);

-- itens do pedido
drop policy if exists pi_select_own   on pedido_itens;
drop policy if exists pi_admin_select on pedido_itens;
create policy pi_select on pedido_itens for select using (
  (select is_admin())
  or exists (
    select 1 from pedidos p
     where p.id = pedido_id
       and p.fornecedor_id = (select current_fornecedor_id())
  )
);

drop policy if exists pi_insert_own on pedido_itens;
create policy pi_insert_own on pedido_itens for insert with check (
  exists (
    select 1 from pedidos p
     where p.id = pedido_id
       and p.fornecedor_id = (select current_fornecedor_id())
  )
);

-- importações (log)
drop policy if exists imp_admin_select on importacoes;
create policy imp_admin_select on importacoes for select using (
  (select is_admin())
);

analyze produtos;
