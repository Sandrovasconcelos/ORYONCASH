"use client";

export function DeleteButton({
  despesaId,
  action,
}: {
  despesaId: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Excluir esta despesa? Essa ação não pode ser desfeita.")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={despesaId} />
      <button type="submit" className="text-sm font-medium text-red-600 hover:underline">
        Excluir
      </button>
    </form>
  );
}
