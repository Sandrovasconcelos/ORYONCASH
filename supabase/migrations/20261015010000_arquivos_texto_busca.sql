-- Texto lido do arquivo (numeros, nomes, enderecos, datas...) pra a busca achar
-- o documento por qualquer informacao, e pasta de projeto pra obra que ainda
-- nao existe no financeiro (area "obra" com obra_id vazio e pasta preenchida).
alter table arquivos add column if not exists texto_busca text;
