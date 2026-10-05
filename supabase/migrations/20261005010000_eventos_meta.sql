-- Avisos que a Meta manda no webhook do WhatsApp (ban, revisao da conta, alertas,
-- nome de exibicao, falhas graves de envio). Guardados para saber o MOTIVO quando
-- a conta cair, em vez de descartar.
create table if not exists eventos_meta (
  id uuid primary key default gen_random_uuid(),
  recebido_em timestamptz not null default now(),
  campo text not null,
  evento text not null,
  resumo text not null,
  importante boolean not null default false,
  payload jsonb
);

create index if not exists eventos_meta_recebido_em_idx on eventos_meta (recebido_em desc);

alter table eventos_meta enable row level security;
