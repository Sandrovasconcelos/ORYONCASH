import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { googleConfigurado, urlDeAutorizacao } from "@/lib/google/oauth";

/** Comeca a conexao com o Google Drive (so com o login do painel). */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  if (!googleConfigurado()) {
    return NextResponse.redirect(new URL("/dashboard/arquivos?google=sem-chaves", request.url));
  }

  const state = crypto.randomUUID();
  const resposta = NextResponse.redirect(urlDeAutorizacao(state));
  resposta.cookies.set("google_oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/api/google" });
  return resposta;
}
