-- =============================================================
-- Vários logins por fornecedor + vários e-mails vindos do ERP.
--
-- fornecedor_usuarios já permite N usuários por fornecedor (a chave é o
-- usuário). O que faltava era a visão agrupada por fornecedor, para a tela
-- listar os acessos existentes e permitir adicionar outro.
--
-- fornecedores.emails guarda todos os e-mails de contato que vierem no
-- arquivo do ERP (o portal só sugere; não edita).
-- =============================================================

alter table fornecedores add column if not exists emails text[];

create index if not exists idx_fornecedor_usuarios_fornecedor
  on fornecedor_usuarios(fornecedor_id);

create or replace view admin_acessos
with (security_invoker = true) as
select
  f.id                as fornecedor_id,
  f.codigo_fabricante,
  f.nome,
  f.email             as email_cadastro,
  f.emails            as emails_cadastro,
  (select count(*) from produtos p where p.fornecedor_id = f.id)  as produtos,
  (select count(*) from fornecedor_usuarios fu
     where fu.fornecedor_id = f.id)                               as qtd_acessos,
  (select count(*) from fornecedor_usuarios fu
     where fu.fornecedor_id = f.id and fu.ativo)                  as qtd_ativos,
  coalesce(
    (select jsonb_agg(
              jsonb_build_object(
                'user_id',      fu.user_id,
                'email',        fu.email,
                'ativo',        fu.ativo,
                'convidado_em', fu.convidado_em
              )
              order by fu.convidado_em nulls last
            )
       from fornecedor_usuarios fu
      where fu.fornecedor_id = f.id),
    '[]'::jsonb
  )                   as acessos
from fornecedores f;

grant select on admin_acessos to authenticated;
