-- Ultimo estado conhecido de cada canal/servico monitorado (WhatsApp,
-- Telegram, Gemini, banco, fila de leituras). O monitor de saude so avisa
-- quando o estado MUDA (caiu / voltou) e de tempos em tempos enquanto
-- continuar com problema - sem isso mandaria o mesmo alerta a cada checagem.
create table if not exists saude_canais (
  canal text primary key,
  ok boolean not null,
  detalhe text,
  mudou_em timestamptz not null default now(),
  ultimo_aviso_em timestamptz
);

alter table saude_canais enable row level security;

create policy "authenticated full access" on saude_canais
  for all to authenticated using (true) with check (true);
