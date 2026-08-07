-- Permite anexar o contrato assinado (PDF ou Word) a um
-- contrato de fornecedor.
alter table contratos_fornecedor
  add column if not exists arquivo_storage_path text,
  add column if not exists arquivo_nome text,
  add column if not exists arquivo_mime_type text;
