import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Termos de Serviço - OryonCash",
};

export default function TermosPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-5 py-10 text-sm leading-6 text-brand-gray-700">
      <h1 className="text-2xl font-black text-brand-black">Termos de Serviço</h1>
      <p>
        O OryonCash é um sistema interno da Oryon Construção e Engenharia para controle financeiro de obras e organização de
        documentos. O acesso é restrito a pessoas autorizadas pela empresa.
      </p>
      <ul className="list-disc pl-5">
        <li>O usuário é responsável pelas informações e arquivos que envia ao sistema.</li>
        <li>O acesso pode ser suspenso a qualquer momento pela empresa.</li>
        <li>Quando conectado ao Google Drive, o sistema só acessa os arquivos que ele mesmo cria, conforme a Política de Privacidade.</li>
        <li>O sistema é fornecido como está, sem garantia de disponibilidade ininterrupta.</li>
      </ul>
      <p>
        Veja também a{" "}
        <Link href="/privacidade" className="underline">
          Política de Privacidade
        </Link>
        .
      </p>
      <Link href="/" className="mt-4 text-brand-red underline">
        Voltar ao OryonCash
      </Link>
    </main>
  );
}
