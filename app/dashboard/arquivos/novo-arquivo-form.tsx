"use client";

import { useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { useFecharModal } from "../modal-context";
import { prepararUploadArquivoAction, registrarArquivoAction } from "./actions";
import { CamposDeLocal } from "./campos-de-local";
import { CLASSE_CAMPO, CLASSE_ROTULO } from "./estilos";
import type { AreaArquivo } from "@/lib/arquivos/tipos";

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
  const [etapa, setEtapa] = useState<"" | "enviando" | "salvando">("");
  const [, startTransition] = useTransition();

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const form = formRef.current;
    if (!form) return;
    const dados = new FormData(form);
    const arquivo = dados.get("arquivo");
    if (!(arquivo instanceof File) || arquivo.size === 0) {
      setErro("Escolha o arquivo.");
      return;
    }

    setEtapa("enviando");
    const preparo = await prepararUploadArquivoAction(arquivo.name, arquivo.type, arquivo.size, {
      area: String(dados.get("area") ?? "obra"),
      obraId: String(dados.get("obra_id") ?? ""),
      pasta: String(dados.get("pasta") ?? ""),
      tipo: String(dados.get("tipo") ?? ""),
    });
    if ("erro" in preparo) {
      setErro(preparo.erro);
      setEtapa("");
      return;
    }

    if (preparo.modo === "drive") {
      // Direto do navegador pro Google Drive (o arquivo nao passa pelo servidor).
      try {
        const res = await fetch(preparo.url, {
          method: "PUT",
          headers: { "Content-Type": arquivo.type || "application/octet-stream" },
          body: arquivo,
        });
        const corpo = res.ok ? ((await res.json()) as { id?: string }) : null;
        if (!corpo?.id) throw new Error(`Drive respondeu ${res.status}`);
        dados.set("drive_file_id", corpo.id);
      } catch {
        setErro("Não consegui enviar o arquivo pro Google Drive. Tente de novo.");
        setEtapa("");
        return;
      }
    } else {
      const { error } = await createClient()
        .storage.from("comprovantes")
        .uploadToSignedUrl(preparo.path, preparo.token, arquivo, { contentType: arquivo.type || "application/octet-stream" });
      if (error) {
        setErro("Não consegui enviar o arquivo. Tente de novo.");
        setEtapa("");
        return;
      }
      dados.set("storage_path", preparo.path);
    }

    setEtapa("salvando");
    dados.delete("arquivo");
    dados.set("nome_arquivo", arquivo.name);
    dados.set("mime_type", arquivo.type);
    dados.set("tamanho_bytes", String(arquivo.size));
    if (!String(dados.get("nome") ?? "").trim()) dados.set("nome", arquivo.name.replace(/\.[^.]+$/, ""));

    startTransition(async () => {
      const resultado = await registrarArquivoAction(dados);
      if ("erro" in resultado) {
        setErro(resultado.erro);
        setEtapa("");
        return;
      }
      setEtapa("");
      form.reset();
      fechar?.();
    });
  }

  const ocupado = etapa !== "";

  return (
    <form ref={formRef} onSubmit={enviar} className="flex flex-col gap-4 text-left">
      <label className={CLASSE_ROTULO}>
        Arquivo (até 100 MB)
        <input
          type="file"
          name="arquivo"
          required
          className="rounded-brand-sm border border-black/10 px-3 py-2 text-sm font-medium text-brand-black file:mr-3 file:rounded-brand-sm file:border-0 file:bg-brand-black file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white"
        />
      </label>
      <label className={CLASSE_ROTULO}>
        Nome (opcional)
        <input name="nome" placeholder="Ex: Matrícula do lote 12" className={CLASSE_CAMPO} />
      </label>
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
      {erro && <p className="rounded-brand-sm bg-brand-red/10 px-3 py-2 text-sm font-semibold text-brand-red">{erro}</p>}
      <button type="submit" disabled={ocupado} className="oc-button oc-button-primary self-start disabled:cursor-wait disabled:opacity-70">
        {etapa === "enviando" ? "Enviando arquivo..." : etapa === "salvando" ? "Guardando..." : "Guardar arquivo"}
      </button>
    </form>
  );
}
