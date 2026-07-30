-- =============================================================
-- Gestão de acessos dos fornecedores.
--
-- Fluxo: a Capital libera o acesso -> o admin convida por e-mail ->
-- o fornecedor define a senha -> o admin pode cortar/reativar o acesso.
--
-- O e-mail do fornecedor virá no arquivo do ERP (coluna nova); enquanto
-- isso, o admin pode digitar na tela.
-- =============================================================

-- e-mail vindo do cadastro do ERP
alter table fornecedores add column if not exists email text;

-- controle do vínculo de acesso
alter table fornecedor_usuarios add column if not exists ativo        boolean not null default true;
alter table fornecedor_usuarios add column if not exists email        text;
alter table fornecedor_usuarios add column if not exists convidado_em timestamptz;
alter table fornecedor_usuarios add column if not exists criado_por   uuid references auth.users(id);

-- ---------- cortar o acesso passa a ter efeito imediato ----------
-- vínculo inativo deixa de resolver o fornecedor => o usuário não vê nada.
create or replace function current_fornecedor_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select fornecedor_id
    from fornecedor_usuarios
   where user_id = auth.uid()
     and ativo
$$;

-- ---------- admin enxerga todos os vínculos ----------
drop policy if exists fu_select_own on fornecedor_usuarios;
create policy fu_select on fornecedor_usuarios for select using (
  (select is_admin()) or user_id = (select auth.uid())
);

-- ---------- achar usuário existente pelo e-mail (para reconvite) ----------
create or replace function usuario_id_por_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select case when is_admin()
              then (select id from auth.users where lower(email) = lower(p_email) limit 1)
         end
$$;

grant execute on function usuario_id_por_email(text) to authenticated;

-- ---------- visão de acessos para o admin ----------
create or replace view admin_acessos
with (security_invoker = true) as
select
  f.id                as fornecedor_id,
  f.codigo_fabricante,
  f.nome,
  f.email             as email_cadastro,
  fu.user_id,
  fu.email            as email_acesso,
  fu.ativo,
  fu.convidado_em,
  (select count(*) from produtos p where p.fornecedor_id = f.id) as produtos
from fornecedores f
left join fornecedor_usuarios fu on fu.fornecedor_id = f.id;

grant select on admin_acessos to authenticated;

-- "acessos ativos" passa a considerar só os vínculos não cortados
create or replace view admin_resumo
with (security_invoker = true) as
select
  (select count(*) from pedidos)                                   as total_pedidos,
  (select coalesce(sum(total), 0) from pedidos)                    as valor_total,
  (select count(*) from pedidos
     where data_registro >= now() - interval '7 days')             as pedidos_7d,
  (select count(*) from produtos)                                  as total_produtos,
  (select count(*) from fornecedores)                              as total_fornecedores,
  (select count(*) from fornecedores
     where documento_tipo = 'INVALIDO')                            as documentos_a_corrigir,
  (select count(*) from fornecedor_usuarios where ativo)           as acessos_ativos;
