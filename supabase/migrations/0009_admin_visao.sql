-- =============================================================
-- Visão do administrador: resumo geral + pedidos com o nome do fornecedor.
-- security_invoker = true => respeita o RLS (só admin enxerga tudo).
-- =============================================================

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
  (select count(*) from fornecedor_usuarios)                       as acessos_ativos;

create or replace view admin_pedidos
with (security_invoker = true) as
select
  p.id,
  p.data_registro,
  p.total,
  p.observacao,
  p.ciente_valores,
  f.codigo_fabricante as fornecedor_codigo,
  f.nome              as fornecedor_nome,
  (select count(*) from pedido_itens pi where pi.pedido_id = p.id) as itens
from pedidos p
join fornecedores f on f.id = p.fornecedor_id;

grant select on admin_resumo, admin_pedidos to authenticated;
