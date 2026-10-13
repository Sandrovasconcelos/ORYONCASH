import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extensaoDoArquivo, nomeSeguro } from "@/lib/arquivos/nomes";

/** Abre (ou baixa) um arquivo da biblioteca: confere o login e redireciona pra um link temporario. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const admin = createAdminClient();
  const { data: arquivo } = await admin
    .from("arquivos")
    .select("nome, nome_arquivo, mime_type, storage_bucket, storage_path")
    .eq("id", id)
    .maybeSingle();
  if (!arquivo) return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });

  const baixar = request.nextUrl.searchParams.get("baixar") === "1";
  const nomeDownload = `${nomeSeguro(arquivo.nome)}.${extensaoDoArquivo(arquivo.mime_type, arquivo.nome_arquivo)}`;
  const { data, error } = await admin.storage
    .from(arquivo.storage_bucket)
    .createSignedUrl(arquivo.storage_path, 60 * 5, baixar ? { download: nomeDownload } : undefined);
  if (error || !data?.signedUrl) return NextResponse.json({ error: "Não consegui abrir o arquivo" }, { status: 500 });

  return NextResponse.redirect(data.signedUrl);
}
