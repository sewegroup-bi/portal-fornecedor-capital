-- =============================================================
-- Busca rápida e correta de produtos.
-- - pg_trgm + índices GIN: ilike '%termo%' fica rápido em 105k linhas
-- - função buscar_produtos: SQL correto (só o que contém o termo),
--   security invoker => respeita o RLS (fornecedor vê só o dele; admin vê tudo)
-- =============================================================

create extension if not exists pg_trgm;

create index if not exists idx_produtos_nome_trgm
  on produtos using gin (nome gin_trgm_ops);
create index if not exists idx_produtos_codforn_trgm
  on produtos using gin (codigo_fornecedor gin_trgm_ops);
create index if not exists idx_produtos_ref_trgm
  on produtos using gin (codigo_produto_ref gin_trgm_ops);

create or replace function buscar_produtos(
  p_termo  text default '',
  p_offset int default 0,
  p_limit  int default 50
)
returns setof produtos
language sql
stable
security invoker
set search_path = public
as $$
  select *
  from produtos
  where ativo = true
    and (
      coalesce(p_termo, '') = ''
      or codigo_fornecedor ilike '%' || p_termo || '%'
      or nome ilike '%' || p_termo || '%'
      or coalesce(codigo_produto_ref, '') ilike '%' || p_termo || '%'
    )
  order by codigo_fornecedor
  offset p_offset
  limit p_limit;
$$;

grant execute on function buscar_produtos(text, int, int) to authenticated;
