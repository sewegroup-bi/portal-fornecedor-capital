-- =============================================================
-- Busca rápida de produtos: pg_trgm + índices GIN.
-- Com eles, "ilike '%termo%'" fica rápido mesmo em 105k linhas.
-- O filtro em si é feito pela Data API (PostgREST), que já respeita o RLS.
--
-- gin_trgm_ops é referenciado SEM qualificar o schema: o Postgres resolve
-- pelo search_path, independentemente de onde a extensão esteja instalada
-- (em alguns projetos é "public", em outros "extensions").
-- =============================================================

-- a função RPC anterior não é mais usada (o filtro voltou para a Data API)
drop function if exists buscar_produtos(text, int, int);

create extension if not exists pg_trgm;

create index if not exists idx_produtos_nome_trgm
  on produtos using gin (nome gin_trgm_ops);

create index if not exists idx_produtos_codforn_trgm
  on produtos using gin (codigo_fornecedor gin_trgm_ops);

create index if not exists idx_produtos_ref_trgm
  on produtos using gin (codigo_produto_ref gin_trgm_ops);
