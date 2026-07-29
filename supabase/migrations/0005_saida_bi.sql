-- =============================================================
-- SAÍDA DE DADOS: view "pronta para BI" (grão = item de pedido).
-- Formato-agnóstica: serve para conexão direta do Qlik, geração de CSV
-- para a pasta SAÍDA do Drive, ou API. security_invoker = true faz a view
-- respeitar o RLS das tabelas base (fornecedor só vê o seu; admin vê tudo),
-- então é seguro mesmo se exposta pela Data API.
-- =============================================================

create or replace view saida_pedidos
with (security_invoker = true) as
select
  p.id                     as pedido_id,
  p.data_registro,
  p.observacao,
  p.ciente_valores,
  p.ciente_em,
  p.total                  as pedido_total,
  f.codigo_fabricante      as fornecedor_codigo,
  f.nome                   as fornecedor_nome,
  f.documento              as fornecedor_documento,
  f.documento_tipo         as fornecedor_documento_tipo,
  pr.codigo_fornecedor     as produto_codigo,
  pr.codigo_produto_ref    as produto_ref,
  pr.nome                  as produto_nome,
  pr.ean,
  pr.situacao,
  pi.quantidade,
  pi.custo_unitario,
  pi.subtotal
from pedido_itens pi
join pedidos p       on p.id = pi.pedido_id
join produtos pr     on pr.id = pi.produto_id
join fornecedores f  on f.id = p.fornecedor_id;

grant select on saida_pedidos to authenticated;
