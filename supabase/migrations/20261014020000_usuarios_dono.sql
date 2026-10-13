-- Agenda/lembretes e biblioteca de arquivos sao so do Sandro. Quem tem
-- "dono" = true usa essas funcoes; os demais (ex: Leo) ficam so com o
-- financeiro do OryonCash.
alter table usuarios_whatsapp add column if not exists dono boolean not null default false;

update usuarios_whatsapp
set dono = true
where telefone in ('5598988219864', '559888219864', 'tg_264230451');
