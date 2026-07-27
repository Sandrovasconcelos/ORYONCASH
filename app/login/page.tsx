"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    setCarregando(false);

    if (error) {
      setErro("Email ou senha inválidos.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="grid min-h-screen flex-1 bg-white lg:grid-cols-[1.05fr_.95fr]">
      <section className="relative hidden overflow-hidden bg-[#111317] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand-red/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-brand-sm bg-[linear-gradient(145deg,#ef343a,#9c0b11)] font-display font-extrabold">O</span>
          <span className="font-display text-base font-extrabold tracking-[.1em]">ORYONCASH</span>
        </div>
        <div className="relative max-w-xl">
          <p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-brand-red">Módulo WhatsApp</p>
          <h1 className="mt-4 font-display text-4xl font-bold leading-tight">
            Controle financeiro da obra, sem perder o ritmo.
          </h1>
          <p className="mt-5 max-w-lg text-sm leading-7 text-[#aab0b9]">
            Registre pelo WhatsApp. Revise no dashboard. Acompanhe orçamento,
            fornecedores e cada lançamento em um só lugar.
          </p>
        </div>
        <p className="relative text-[10px] font-bold uppercase tracking-[.16em] text-brand-gray-500">
          Clareza · Controle · Segurança
        </p>
      </section>

      <section className="flex items-center justify-center bg-brand-gray-100 px-5 py-10 sm:px-10">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-md rounded-card border border-brand-gray-300 bg-white p-7 shadow-card sm:p-10"
        >
          <span className="flex items-center gap-3 text-base font-semibold text-brand-black lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-brand-sm bg-brand-red font-display text-sm font-extrabold text-white">
              O
            </span>
            <span className="font-display text-sm font-extrabold tracking-[.08em]">ORYONCASH</span>
          </span>

          <p className="mt-8 text-[10px] font-extrabold uppercase tracking-[.16em] text-brand-red lg:mt-0">
            Área protegida
          </p>
          <h2 className="mt-2 font-display text-2xl font-bold text-brand-black">
            Bem-vindo de volta
          </h2>
          <p className="mt-2 text-sm leading-6 text-brand-gray-500">
            Entre com sua conta para acessar o módulo.
          </p>

          <div className="mt-7 flex flex-col gap-5">
          <label className="flex flex-col gap-2 text-xs font-bold text-brand-gray-700">
            Email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com.br"
              className="h-11 rounded-brand-sm border border-brand-gray-300 bg-white px-3 text-sm font-medium outline-none focus:border-brand-red"
            />
          </label>

          <label className="flex flex-col gap-2 text-xs font-bold text-brand-gray-700">
            Senha
            <input
              type="password"
              autoComplete="current-password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Digite sua senha"
              className="h-11 rounded-brand-sm border border-brand-gray-300 bg-white px-3 text-sm font-medium outline-none focus:border-brand-red"
            />
          </label>
        </div>

          {erro && (
            <p role="alert" className="mt-4 rounded-brand-sm bg-brand-red/5 px-3 py-2 text-sm font-semibold text-status-danger">
              {erro}
            </p>
          )}

        <button
          type="submit"
          disabled={carregando}
          className="mt-7 h-11 w-full rounded-brand-sm bg-brand-red px-4 text-sm font-extrabold text-white shadow-lg shadow-brand-red/15 hover:-translate-y-0.5 hover:bg-brand-red-700 disabled:translate-y-0 disabled:opacity-60"
        >
          {carregando ? "Entrando..." : "Entrar"}
        </button>
        </form>
      </section>
    </main>
  );
}
