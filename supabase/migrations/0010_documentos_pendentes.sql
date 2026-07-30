-- =============================================================
-- Fornecedores com documento pendente de correção (CNPJ/CPF inválido
-- ou vazio na origem), com a contagem de produtos para priorizar.
-- security_invoker = true => só admin enxerga (RLS de fornecedores).
-- =============================================================

create or replace view fornecedores_documentos_pendentes
with (security_invoker = true) as
select
  f.id,
  f.codigo_fabricante,
  f.nome,
  f.documento,
  (select count(*) from produtos p where p.fornecedor_id = f.id) as produtos
from fornecedores f
where f.documento_tipo is distinct from 'CNPJ'
  and f.documento_tipo is distinct from 'CPF';

grant select on fornecedores_documentos_pendentes to authenticated;
