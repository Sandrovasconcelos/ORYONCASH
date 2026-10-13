import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { baixarDoDrive, BUCKET_DRIVE } from "@/lib/google/drive";
import { linkValido } from "@/lib/arquivos/linkAssinado";
import { nomeParaDownload } from "@/lib/arquivos/nomes";

export const maxDuration = 60;

/** Link temporario assinado (enviado pelo bot): entrega um arquivo do Drive sem pedir login. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = request.nextUrl.searchParams;
  if (!linkValido(id, p.get("exp"), p.get("sig"))) return NextResponse.json({ error: "Link inválido ou expirado" }, { status: 403 });

  const { data: arquivo } = await createAdminClient()
    .from("arquivos")
    .select("nome, nome_arquivo, mime_type, storage_bucket, storage_path")
    .eq("id", id)
    .maybeSingle();
  if (!arquivo || arquivo.storage_bucket !== BUCKET_DRIVE) return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });

  try {
    const origem = await baixarDoDrive(arquivo.storage_path);
    const nome = nomeParaDownload(arquivo);
    return new Response(origem.body, {
      headers: {
        "Content-Type": arquivo.mime_type ?? "application/octet-stream",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(nome)}`,
        ...(origem.headers.get("content-length") ? { "Content-Length": origem.headers.get("content-length") as string } : {}),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Erro ao baixar do Drive:", error);
    return NextResponse.json({ error: "Não consegui abrir o arquivo" }, { status: 502 });
  }
}
