alter table fornecedores
  add column if not exists cpf text unique,
  add column if not exists chave_pix text,
  add column if not exists conta_banco text,
  add column if not exists conta_agencia text,
  add column if not exists conta_numero text;

alter table despesa_comprovantes
  add column if not exists numero_documento text;
