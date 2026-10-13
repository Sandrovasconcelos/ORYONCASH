const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

// drive.file: o app so enxerga o que ele mesmo criou no Drive (nada do resto).
const ESCOPOS = ["https://www.googleapis.com/auth/drive.file", "openid", "email"];

export function googleConfigurado(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/** Tem que ser identico ao endereco cadastrado no cliente OAuth do Google Cloud. */
export function redirectUri(): string {
  return process.env.GOOGLE_REDIRECT_URI ?? "https://oryoncash.vercel.app/api/google/callback";
}

export function urlDeAutorizacao(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: ESCOPOS.join(" "),
    access_type: "offline",
    // Garante o refresh_token mesmo se o app ja foi autorizado antes.
    prompt: "consent",
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

function emailDoIdToken(idToken: string | undefined): string | null {
  if (!idToken) return null;
  try {
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString("utf8")) as { email?: string };
    return payload.email ?? null;
  } catch {
    return null;
  }
}

export async function trocarCodigo(code: string): Promise<{ refreshToken: string; email: string | null } | null> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    console.error("Google: falha ao trocar o codigo:", res.status, await res.text().catch(() => ""));
    return null;
  }
  const data = (await res.json()) as { refresh_token?: string; id_token?: string };
  if (!data.refresh_token) return null;
  return { refreshToken: data.refresh_token, email: emailDoIdToken(data.id_token) };
}

export async function renovarToken(refreshToken: string): Promise<{ accessToken: string; expiraEm: number } | null> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    console.error("Google: falha ao renovar o token:", res.status, await res.text().catch(() => ""));
    return null;
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  return { accessToken: data.access_token, expiraEm: Date.now() + (data.expires_in - 60) * 1000 };
}
