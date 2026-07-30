-- =============================================================
-- O ERP (Full Screen) é a FONTE DA VERDADE do cadastro.
-- O portal não cria nem edita fornecedor/produto: apenas espelha o que
-- chega pela importação e REPORTA as pendências para correção no ERP.
--
-- Por isso a correção manual de documento é removida (era divergência:
-- arrumaria aqui e continuaria errado lá).
-- =============================================================

drop trigger  if exists trg_preserva_documento on fornecedores;
drop function if exists preserva_documento_corrigido();
drop function if exists corrigir_documento(uuid, text, text, text);
alter table fornecedores drop column if exists documento_corrigido;

-- ---------- controle da importação automática ----------
-- guarda a "assinatura" do arquivo lido, para pular quando nada mudou
alter table importacoes add column if not exists arquivo_checksum      text;
alter table importacoes add column if not exists arquivo_modificado_em timestamptz;
alter table importacoes add column if not exists automatica            boolean not null default false;
alter table importacoes add column if not exists resultado             text; -- 'importado' | 'sem_alteracao' | 'erro'
