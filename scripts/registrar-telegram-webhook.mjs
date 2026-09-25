// Uso: node scripts/registrar-telegram-webhook.mjs [URL_BASE]
// Le TELEGRAM_BOT_TOKEN e TELEGRAM_WEBHOOK_SECRET do .env.local e aponta o
// bot pra rota /api/telegram/webhook (padrao: producao).
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    })
);

const token = env.TELEGRAM_BOT_TOKEN;
const secret = env.TELEGRAM_WEBHOOK_SECRET;
if (!token || !secret) {
  console.error("Faltam TELEGRAM_BOT_TOKEN e/ou TELEGRAM_WEBHOOK_SECRET no .env.local");
  process.exit(1);
}

const base = (process.argv[2] ?? "https://oryoncash.vercel.app").replace(/\/$/, "");
const chamar = async (metodo, corpo) => {
  const r = await fetch(`https://api.telegram.org/bot${token}/${metodo}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo ?? {}),
  });
  return r.json();
};

const set = await chamar("setWebhook", {
  url: `${base}/api/telegram/webhook`,
  secret_token: secret,
  allowed_updates: ["message", "callback_query"],
  drop_pending_updates: false,
});
console.log("setWebhook:", set.ok ? "OK" : set);

await chamar("setMyCommands", {
  commands: [
    { command: "menu", description: "Abrir o menu principal" },
    { command: "cancelar", description: "Cancelar e voltar ao menu" },
  ],
});

const info = await chamar("getWebhookInfo");
console.log("webhook:", info.result?.url, "| pendentes:", info.result?.pending_update_count, "| ultimo erro:", info.result?.last_error_message ?? "nenhum");
