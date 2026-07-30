-- =============================================================
-- Protege as correções manuais de documento.
--
-- A importação faz upsert de fornecedores com os dados do CSV — que traz
-- documentos quebrados. Sem isso, cada importação apagaria as correções
-- feitas na tela /admin/documentos.
--
-- Como funciona:
--  - fornecedores.documento_corrigido marca quem já foi ajustado à mão;
--  - um trigger BEFORE UPDATE preserva o documento desses fornecedores;
--  - a função corrigir_documento() é a ÚNICA porta que pode alterá-lo
--    (sinaliza via set_config, para o trigger deixar passar).
-- =============================================================

alter table fornecedores
  add column if not exists documento_corrigido boolean not null default false;

-- ---------- trigger: importação não sobrescreve correção manual ----------
create or replace function preserva_documento_corrigido()
returns trigger
language plpgsql
as $$
begin
  if old.documento_corrigido
     and coalesce(current_setting('app.corrigindo_documento', true), '') <> 'on'
  then
    new.documento           := old.documento;
    new.documento_tipo      := old.documento_tipo;
    new.cnpj                := old.cnpj;
    new.documento_corrigido := true;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_preserva_documento on fornecedores;
create trigger trg_preserva_documento
  before update on fornecedores
  for each row
  execute function preserva_documento_corrigido();

-- ---------- a porta oficial da correção manual ----------
-- security definer: fornecedores não tem policy de UPDATE (ninguém escreve
-- direto). A função valida que quem chama é admin antes de gravar.
create or replace function corrigir_documento(
  p_fornecedor_id uuid,
  p_documento     text,
  p_tipo          text,
  p_cnpj          text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Acesso restrito a administradores';
  end if;

  -- libera o trigger apenas nesta transação
  perform set_config('app.corrigindo_documento', 'on', true);

  update fornecedores
     set documento           = p_documento,
         documento_tipo      = p_tipo,
         cnpj                = p_cnpj,
         documento_corrigido = true
   where id = p_fornecedor_id;
end;
$$;

grant execute on function corrigir_documento(uuid, text, text, text) to authenticated;
