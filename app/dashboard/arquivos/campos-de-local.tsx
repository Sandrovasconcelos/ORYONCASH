"use client";

import { useState } from "react";
import { AREAS, TIPOS_SUGERIDOS, type AreaArquivo } from "@/lib/arquivos/tipos";

import { CLASSE_CAMPO, CLASSE_ROTULO } from "./estilos";

/** Onde o arquivo mora: area, obra (ou licitacao/pasta) e tipo. O que aparece depende da area. */
export function CamposDeLocal({
  obras,
  areaInicial = "obra",
  obraIdInicial = "",
  pastaInicial = "",
  tipoInicial = "",
  sugestoesDePasta = [],
}: {
  obras: { id: string; nome: string }[];
  areaInicial?: AreaArquivo;
  obraIdInicial?: string;
  pastaInicial?: string;
  tipoInicial?: string;
  sugestoesDePasta?: string[];
}) {
  const [area, setArea] = useState<AreaArquivo>(areaInicial);
  const [obraSel, setObraSel] = useState(obraIdInicial || (areaInicial === "obra" && pastaInicial ? "__projeto" : ""));
  const mostrarPasta = area !== "obra" || obraSel === "__projeto";
  const idLista = `tipos-${area}`;
  const idPastas = "pastas-sugeridas";

  return (
    <>
      <label className={CLASSE_ROTULO}>
        Área
        <select name="area" value={area} onChange={(e) => setArea(e.target.value as AreaArquivo)} className={CLASSE_CAMPO}>
          {AREAS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.rotulo}
            </option>
          ))}
        </select>
      </label>

      {area === "obra" && (
        <label className={CLASSE_ROTULO}>
          Obra
          <select name="obra_id" value={obraSel} onChange={(e) => setObraSel(e.target.value)} className={CLASSE_CAMPO}>
            <option value="">Sem obra definida</option>
            {obras.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome}
              </option>
            ))}
            <option value="__projeto">Projeto (obra que não está no financeiro)…</option>
          </select>
        </label>
      )}

      {mostrarPasta && (
        <label className={CLASSE_ROTULO}>
          {area === "licitacao" ? "Licitação" : area === "obra" ? "Nome do projeto" : "Pasta (opcional)"}
          <input
            name="pasta"
            defaultValue={pastaInicial}
            list={idPastas}
            placeholder={area === "licitacao" ? "Ex: Concorrência 04/2026" : area === "obra" ? "Ex: Villa Borghese" : "Ex: Geral"}
            className={CLASSE_CAMPO}
          />
          <datalist id={idPastas}>
            {sugestoesDePasta.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </label>
      )}

      <label className={CLASSE_ROTULO}>
        Tipo
        <input
          name="tipo"
          defaultValue={tipoInicial}
          list={idLista}
          placeholder="Ex: Licenças"
          className={CLASSE_CAMPO}
        />
        <datalist id={idLista}>
          {TIPOS_SUGERIDOS[area].map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </label>
    </>
  );
}
