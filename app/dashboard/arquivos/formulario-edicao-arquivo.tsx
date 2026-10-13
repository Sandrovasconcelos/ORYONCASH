import { SubmitButton } from "../submit-button";
import { FecharAoTerminar } from "./fechar-ao-terminar";
import { atualizarArquivoAction } from "./actions";
import { CamposDeLocal } from "./campos-de-local";
import { CLASSE_CAMPO, CLASSE_ROTULO } from "./estilos";
import type { AreaArquivo } from "@/lib/arquivos/tipos";

export type ArquivoEditavel = {
  id: string;
  nome: string;
  area: AreaArquivo;
  obra_id: string | null;
  pasta: string | null;
  tipo: string;
  descricao: string | null;
  validade: string | null;
  avisar_dias_antes: number;
};

export function FormularioEdicaoArquivo({
  arquivo,
  obras,
  sugestoesDePasta,
}: {
  arquivo: ArquivoEditavel;
  obras: { id: string; nome: string }[];
  sugestoesDePasta: string[];
}) {
  return (
    <form action={atualizarArquivoAction} className="flex flex-col gap-4 text-left">
      <input type="hidden" name="id" value={arquivo.id} />
      <label className={CLASSE_ROTULO}>
        Nome
        <input name="nome" required defaultValue={arquivo.nome} className={CLASSE_CAMPO} />
      </label>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CamposDeLocal
          obras={obras}
          areaInicial={arquivo.area}
          obraIdInicial={arquivo.obra_id ?? ""}
          pastaInicial={arquivo.pasta ?? ""}
          tipoInicial={arquivo.tipo}
          sugestoesDePasta={sugestoesDePasta}
        />
        <label className={CLASSE_ROTULO}>
          Validade (se tiver)
          <input type="date" name="validade" defaultValue={arquivo.validade ?? ""} className={CLASSE_CAMPO} />
        </label>
        <label className={CLASSE_ROTULO}>
          Avisar quantos dias antes?
          <input
            type="number"
            name="avisar_dias_antes"
            defaultValue={arquivo.avisar_dias_antes}
            min={0}
            max={365}
            className={CLASSE_CAMPO}
          />
        </label>
      </div>
      <label className={CLASSE_ROTULO}>
        Observação
        <input name="descricao" defaultValue={arquivo.descricao ?? ""} className={CLASSE_CAMPO} />
      </label>
      <FecharAoTerminar />
      <SubmitButton className="oc-button oc-button-primary self-start">Salvar alterações</SubmitButton>
    </form>
  );
}
