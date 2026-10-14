"use client";

import { useRef, useState } from "react";
import { useFecharModal } from "../modal-context";
import { CamposDeLocal } from "./campos-de-local";
import { CLASSE_CAMPO, CLASSE_ROTULO } from "./estilos";
import { enviarArquivoParaBiblioteca } from "./enviar-cliente";
import type { AreaArquivo } from "@/lib/arquivos/tipos";

type Andamento = { nome: string; estado: "espera" | "enviando" | "ok" | "erro"; mensagem?: string };

export function NovoArquivoForm({
  obras,
  areaInicial,
  obraIdInicial,
  pastaInicial,
  tipoInicial,
  sugestoesDePasta,
}: {
  obras: { id: string; nome: string }[];
  areaInicial?: AreaArquivo;
  obraIdInicial?: string;
  pastaInicial?: string;
  tipoInicial?: string;
  sugestoesDePasta?: string[];
}) {
  const fechar = useFecharModal();
  const formRef = useRef<HTMLFormElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [escolhidos, setEscolhidos] = useState(0);
  const [andamento, setAndamento] = useState<Andamento[]>([]);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const form = formRef.current;
    if (!form) return;
    const dados = new FormData(form);
    const arquivos = dados.getAll("arquivo").filter((a): a is File => a instanceof File && a.size > 0);
    if (arquivos.length === 0) {
      setErro("Escolha pelo menos um arquivo.");
      return;
    }

    // Os campos de local valem pra todos os arquivos desta vez.
    const area = String(dados.get("area") ?? "obra");
    const campos = {
      area,
      obraId: String(dados.get("obra_id") ?? ""),
      pasta: String(dados.get("pasta") ?? ""),
      tipo: String(dados.get("tipo") ?? "").trim() || "Outros",
    };
    const extras = {
      // Nome so vale quando e um arquivo; com varios, cada um usa o proprio nome.
      nome: arquivos.length === 1 ? String(dados.get("nome") ?? "") : "",
      validade: String(dados.get("validade") ?? ""),
      avisar: Number(dados.get("avisar_dias_antes") ?? 30) || 30,
      descricao: String(dados.get("descricao") ?? ""),
    };

    setOcupado(true);
    setAndamento(arquivos.map((a) => ({ nome: a.name, estado: "espera" })));
    let falhas = 0;
    for (let i = 0; i < arquivos.length; i++) {
      setAndamento((atual) => atual.map((p, j) => (j === i ? { ...p, estado: "enviando" } : p)));
      const r = await enviarArquivoParaBiblioteca(arquivos[i], campos, extras);
      if ("erro" in r) falhas += 1;
      setAndamento((atual) => atual.map((p, j) => (j === i ? { ...p, estado: "erro" in r ? "erro" : "ok", mensagem: "erro" in r ? r.erro : undefined } : p)));
    }
    setOcupado(false);

    if (falhas === 0) {
      form.reset();
      setEscolhidos(0);
      fechar?.();
    } else {
      setErro(`${falhas} de ${arquivos.length} arquivo(s) não foram enviados. Veja abaixo e tente de novo.`);
    }
  }

  return (
    <form ref={formRef} onSubmit={enviar} className="flex flex-col gap-4 text-left">
      <label className={CLASSE_ROTULO}>
        Arquivos (até 100 MB cada) — pode escolher vários
        <input
          type="file"
          name="arquivo"
          multiple
          required
          onChange={(e) => setEscolhidos(e.target.files?.length ?? 0)}
          className="rounded-brand-sm border border-black/10 px-3 py-2 text-sm font-medium text-brand-black file:mr-3 file:rounded-brand-sm file:border-0 file:bg-brand-black file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white"
        />
        {escolhidos > 1 && <span className="font-medium text-brand-gray-500">{escolhidos} arquivos escolhidos. Cada um usa o próprio nome.</span>}
      </label>
      {escolhidos <= 1 && (
        <label className={CLASSE_ROTULO}>
          Nome (opcional)
          <input name="nome" placeholder="Ex: Matrícula do lote 12" className={CLASSE_CAMPO} />
        </label>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CamposDeLocal
          obras={obras}
          areaInicial={areaInicial}
          obraIdInicial={obraIdInicial}
          pastaInicial={pastaInicial}
          tipoInicial={tipoInicial}
          sugestoesDePasta={sugestoesDePasta}
        />
        <label className={CLASSE_ROTULO}>
          Validade (se tiver)
          <input type="date" name="validade" className={CLASSE_CAMPO} />
        </label>
        <label className={CLASSE_ROTULO}>
          Avisar quantos dias antes?
          <input type="number" name="avisar_dias_antes" defaultValue={30} min={0} max={365} className={CLASSE_CAMPO} />
        </label>
      </div>
      <label className={CLASSE_ROTULO}>
        Observação (opcional)
        <input name="descricao" className={CLASSE_CAMPO} />
      </label>

      {andamento.length > 1 && (
        <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-brand-sm bg-brand-gray-100 p-3 text-xs">
          {andamento.map((p, i) => (
            <li key={`${p.nome}-${i}`} className="flex items-start justify-between gap-2">
              <span className="truncate text-brand-black">{p.nome}</span>
              <span
                className={`shrink-0 font-bold ${p.estado === "ok" ? "text-status-success" : p.estado === "erro" ? "text-status-danger" : "text-brand-gray-500"}`}
              >
                {p.estado === "ok" ? "guardado" : p.estado === "erro" ? (p.mensagem ?? "erro") : p.estado === "enviando" ? "enviando…" : "na fila"}
              </span>
            </li>
          ))}
        </ul>
      )}

      {erro && <p className="rounded-brand-sm bg-brand-red/10 px-3 py-2 text-sm font-semibold text-brand-red">{erro}</p>}
      <button type="submit" disabled={ocupado} className="oc-button oc-button-primary self-start disabled:cursor-wait disabled:opacity-70">
        {ocupado ? `Enviando${andamento.length > 1 ? ` ${andamento.filter((p) => p.estado === "ok").length + 1} de ${andamento.length}` : ""}...` : escolhidos > 1 ? `Guardar ${escolhidos} arquivos` : "Guardar arquivo"}
      </button>
    </form>
  );
}
