-- CNPJ do fornecedor, usado para reconhecer automaticamente fornecedores ja
-- cadastrados ao ler notas fiscais enviadas pelo WhatsApp.
alter table fornecedores add column if not exists cnpj text unique;
