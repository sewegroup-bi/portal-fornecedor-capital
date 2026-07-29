-- =============================================================
-- Fornecedor passa a ser identificado por codigo_fabricante (não por CNPJ),
-- porque há fabricantes PF (CPF) e PJ (CNPJ), além de documentos corrompidos
-- na origem. O documento vira atributo classificado (CNPJ/CPF/INVALIDO).
--
-- Limpa a importação de teste anterior (mantém o seed Alfa/Beta) para
-- reestruturar com segurança.
-- =============================================================

-- 1) limpar produtos/fornecedores importados (os que têm codigo_fabricante)
delete from produtos
  where fornecedor_id in (select id from fornecedores where codigo_fabricante is not null);
delete from fornecedores where codigo_fabricante is not null;

-- 2) CNPJ deixa de ser chave única e obrigatória
alter table fornecedores drop constraint if exists fornecedores_cnpj_key;
alter table fornecedores alter column cnpj drop not null;

-- 3) novos atributos de documento
alter table fornecedores add column if not exists documento text;        -- valor cru do cgc_fabricante
alter table fornecedores add column if not exists documento_tipo text;   -- 'CNPJ' | 'CPF' | 'INVALIDO'

-- 4) codigo_fabricante passa a ser a chave de deduplicação
create unique index if not exists fornecedores_codigo_fabricante_key
  on fornecedores(codigo_fabricante);
