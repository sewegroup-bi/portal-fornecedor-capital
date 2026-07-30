-- =============================================================
-- Busca rápida de produtos: pg_trgm + índices GIN.
-- Com eles, "ilike '%termo%'" fica rápido mesmo em 105k linhas.
-- O filtro em si é feito pela Data API (PostgREST), que já respeita o RLS.
--
-- Nota: no Supabase as extensões vivem no schema "extensions"; por isso o
-- schema é referenciado explicitamente ao criar a extensão.
-- =============================================================

create extension if not exists pg_trgm with schema extensions;

create index if not exists idx_produtos_nome_trgm
  on produtos using gin (nome extensions.gin_trgm_ops);

create index if not exists idx_produtos_codforn_trgm
  on produtos using gin (codigo_fornecedor extensions.gin_trgm_ops);

create index if not exists idx_produtos_ref_trgm
  on produtos using gin (codigo_produto_ref extensions.gin_trgm_ops);

-- a função RPC anterior não é mais usada (o filtro voltou para a Data API)
drop function if exists buscar_produtos(text, int, int);
