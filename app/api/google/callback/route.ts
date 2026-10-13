import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { trocarCodigo } from "@/lib/google/oauth";
import { salvarConexao } from "@/lib/google/drive";

/** Volta do Google com o codigo de autorizacao: guarda o token e leva de volta pra tela Arquivos. */
export async function GET(request: NextRequest) {
  const destino = (resultado: string) => NextResponse.redirect(new URL(`/dashboard/arquivos?google=${resultado}`, request.url));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const params = request.nextUrl.searchParams;
  const state = params.get("state");
  const esperado = request.cookies.get("google_oauth_state")?.value;
  const code = params.get("code");
  if (params.get("error") || !code || !state || !esperado || state !== esperado) return destino("recusado");

  const tokens = await trocarCodigo(code);
  if (!tokens) return destino("falhou");
  if (!(await salvarConexao(tokens.refreshToken, tokens.email))) return destino("falhou");

  const resposta = destino("ok");
  resposta.cookies.delete({ name: "google_oauth_state", path: "/api/google" });
  return resposta;
}
