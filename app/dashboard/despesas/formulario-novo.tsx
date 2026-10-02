import { createDespesaAction } from "../actions";
import { SubmitButton } from "../submit-button";
import { FecharAoSalvar } from "./fechar-ao-salvar";

type Opcao = { id: string; nome: string };

const CAMPO =
  "w-full rounded-brand-sm border border-brand-gray-300 bg-white px-3 py-2.5 text-base outline-none transition focus:border-brand-red focus:ring-2 focus:ring-brand-red/15 sm:text-sm";
const ROTULO = "flex flex-col gap-1.5 text-xs font-bold text-brand-gray-700";
const SECAO = "mb-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-gray-400";

export function FormularioNovo({
  hoje,
  obras,
  categorias,
  etapas,
  materiais,
  fornecedores,
}: {
  hoje: string;
  obras: Opcao[];
  categorias: Opcao[];
  etapas: (Opcao & { obra_id: string | null })[];
  materiais: Opcao[];
  fornecedores: Opcao[];
}) {
  // Etapas agrupadas por obra (a mesma etapa existe uma vez em cada obra).
  const gruposDeEtapas = [
    ...obras
      .map((obra) => ({ titulo: obra.nome, itens: etapas.filter((e) => e.obra_id === obra.id) }))
      .filter((g) => g.itens.length > 0),
    { titulo: "Etapas padrão", itens: etapas.filter((e) => e.obra_id === null) },
  ].filter((g) => g.itens.length > 0);

  return (
    <form action={createDespesaAction} className="space-y-5 pb-16">
      <FecharAoSalvar />

      <section>
        <p className={SECAO}>Valor e data</p>
        <div className="grid grid-cols-2 gap-3">
          <label className={ROTULO}>
            Valor (R$)
            <input
              name="valor"
              inputMode="decimal"
              placeholder="0,00"
              required
              autoComplete="off"
              className={`${CAMPO} font-display text-lg font-bold sm:text-base`}
            />
          </label>
          <label className={ROTULO}>
            Data
            <input type="date" name="data" defaultValue={hoje} required className={CAMPO} />
          </label>
        </div>
      </section>

      <section>
        <p className={SECAO}>Descrição</p>
        <textarea
          name="descricao"
          rows={2}
          placeholder="O que foi pago ou comprado (ex: 10 m³ de areia)"
          className={CAMPO}
        />
      </section>

      <section>
        <p className={SECAO}>Classificação</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={ROTULO}>
            Obra
            <select name="obra_id" className={CAMPO} defaultValue="">
              <option value="">Sem obra (Administrativo)</option>
              {obras.map((o) => (
                <option key={o.id} value={o.id}>{o.nome}</option>
              ))}
            </select>
          </label>
          <label className={ROTULO}>
            <span>
              Categoria <span className="font-normal text-brand-red">*</span>
            </span>
            <select name="categoria_id" required className={CAMPO} defaultValue="">
              <option value="">Selecione</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </label>
          <label className={ROTULO}>
            Etapa
            <select name="etapa_id" className={CAMPO} defaultValue="">
              <option value="">Sem etapa</option>
              {gruposDeEtapas.map((grupo) => (
                <optgroup key={grupo.titulo} label={grupo.titulo}>
                  {grupo.itens.map((e) => (
                    <option key={e.id} value={e.id}>{e.nome}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className={ROTULO}>
            Material
            <select name="material_id" className={CAMPO} defaultValue="">
              <option value="">Sem material</option>
              {materiais.map((m) => (
                <option key={m.id} value={m.id}>{m.nome}</option>
              ))}
            </select>
          </label>
          <label className={`${ROTULO} sm:col-span-2`}>
            Fornecedor
            <select name="fornecedor_id" className={CAMPO} defaultValue="">
              <option value="">Sem fornecedor</option>
              {fornecedores.map((f) => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <details className="group rounded-brand-sm border border-brand-gray-300/70 bg-brand-gray-100/60">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3 text-xs font-bold text-brand-gray-700">
          Quantidade e valor unitário (opcional)
          <span aria-hidden="true" className="text-brand-gray-400 transition group-open:rotate-180">⌄</span>
        </summary>
        <div className="grid grid-cols-2 gap-3 border-t border-brand-gray-300/60 p-3">
          <label className={ROTULO}>
            Quantidade
            <input name="quantidade" inputMode="decimal" placeholder="Ex: 50" className={CAMPO} />
          </label>
          <label className={ROTULO}>
            Valor unitário
            <input name="valor_unitario" inputMode="decimal" placeholder="Ex: 53,00" className={CAMPO} />
          </label>
        </div>
      </details>

      <div className="sticky -bottom-5 z-10 -mx-5 -mb-5 border-t border-brand-gray-300/70 bg-white/95 px-5 py-3 backdrop-blur sm:-mx-7 sm:px-7">
        <SubmitButton className="w-full rounded-brand-sm bg-brand-red px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-brand-red-700 sm:w-auto">
          Salvar lançamento
        </SubmitButton>
      </div>
    </form>
  );
}
