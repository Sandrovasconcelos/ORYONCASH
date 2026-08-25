import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateDespesaAction } from "../../actions";
import { SubmitButton } from "../../submit-button";

export const dynamic = "force-dynamic";

export default async function EditarDespesaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: despesa } = await supabase
    .from("despesas")
    .select("id, obra_id, categoria_id, etapa_id, material_id, fornecedor_id, descricao, valor, data")
    .eq("id", id)
    .maybeSingle();

  if (!despesa) notFound();

  const [
    { data: obras },
    { data: categorias },
    { data: materiais },
    { data: fornecedores },
    { data: etapasProprias },
  ] = await Promise.all([
    supabase.from("obras").select("id, nome").order("nome"),
    supabase.from("categorias").select("id, nome").order("nome"),
    supabase.from("materiais").select("id, nome").order("nome"),
    supabase.from("fornecedores").select("id, nome").order("nome"),
    despesa.obra_id
      ? supabase.from("etapas").select("id, nome").eq("obra_id", despesa.obra_id).order("ordem")
      : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
  ]);

  let etapas = etapasProprias ?? [];
  if (etapas.length === 0) {
    const { data: etapasGenericas } = await supabase
      .from("etapas")
      .select("id, nome")
      .is("obra_id", null)
      .order("ordem");
    etapas = etapasGenericas ?? [];
  }

  return (
    <form
      action={updateDespesaAction}
      className="grid max-w-4xl grid-cols-1 gap-4 rounded-card border border-brand-gray-300/60 bg-white p-6 shadow-card md:grid-cols-2"
    >
      <input type="hidden" name="id" value={despesa.id} />

      <div className="md:col-span-2">
        <p className="text-lg font-semibold text-brand-black">Editar lancamento</p>
        <p className="text-sm text-brand-gray-500">
          Ajuste obra, categoria, etapa, material, fornecedor, valor e descricao.
        </p>
      </div>

      <Field label="Obra">
        <select name="obra_id" defaultValue={despesa.obra_id ?? ""} className={inputClass}>
          <option value="">Sem obra (Administrativo)</option>
          {(obras ?? []).map((o) => (
            <option key={o.id} value={o.id}>
              {o.nome}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Categoria">
        <select name="categoria_id" defaultValue={despesa.categoria_id} required className={inputClass}>
          {(categorias ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Etapa">
        <select name="etapa_id" defaultValue={despesa.etapa_id ?? ""} className={inputClass}>
          <option value="">Sem etapa</option>
          {etapas.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Material">
        <select name="material_id" defaultValue={despesa.material_id ?? ""} className={inputClass}>
          <option value="">Sem material vinculado</option>
          {(materiais ?? []).map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Fornecedor">
        <select name="fornecedor_id" defaultValue={despesa.fornecedor_id ?? ""} className={inputClass}>
          <option value="">Sem fornecedor</option>
          {(fornecedores ?? []).map((f) => (
            <option key={f.id} value={f.id}>
              {f.nome}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Valor">
        <input name="valor" defaultValue={despesa.valor} required className={inputClass} />
      </Field>

      <Field label="Data">
        <input type="date" name="data" defaultValue={despesa.data} required className={inputClass} />
      </Field>

      <label className="flex flex-col gap-1 text-sm text-brand-gray-700 md:col-span-2">
        Descricao
        <textarea name="descricao" defaultValue={despesa.descricao ?? ""} rows={3} className={inputClass} />
      </label>

      <div className="flex justify-end md:col-span-2">
        <SubmitButton className="rounded-brand-sm bg-brand-red px-5 py-2 text-sm font-semibold text-white hover:bg-brand-red-700">
          Salvar alteracoes
        </SubmitButton>
      </div>
    </form>
  );
}

const inputClass =
  "rounded-brand-sm border border-brand-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-red";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm text-brand-gray-700">
      {label}
      {children}
    </label>
  );
}
