import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de Privacidade - OryonCash",
};

export default function PrivacidadePage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-5 py-10 text-sm leading-6 text-brand-gray-700">
      <h1 className="text-2xl font-black text-brand-black">Política de Privacidade</h1>
      <p>
        O OryonCash é um sistema interno de controle financeiro e de documentos de obras, usado pela equipe da Oryon Construção e
        Engenharia. Esta página descreve como os dados são tratados.
      </p>

      <h2 className="mt-2 text-base font-bold text-brand-black">Dados que o sistema guarda</h2>
      <p>
        Lançamentos de despesas, contas a pagar, compromissos de agenda e arquivos enviados pelo próprio usuário (por exemplo,
        matrículas, certidões e projetos), junto com informações para organizá-los (nome, obra, tipo e validade).
      </p>

      <h2 className="mt-2 text-base font-bold text-brand-black">Integração com o Google Drive</h2>
      <p>
        Quando o usuário conecta a conta do Google, o OryonCash pede apenas a permissão de acesso aos arquivos que ele mesmo cria
        no Drive (escopo <code>drive.file</code>). O sistema não lê, altera nem apaga nenhum outro arquivo do Drive. O acesso pode
        ser revogado a qualquer momento em{" "}
        <a className="underline" href="https://myaccount.google.com/permissions">
          myaccount.google.com/permissions
        </a>
        .
      </p>
      <p>
        O uso e a transferência de informações recebidas das APIs do Google seguem a{" "}
        <a className="underline" href="https://developers.google.com/terms/api-services-user-data-policy">
          Política de Dados do Usuário dos Serviços de API do Google
        </a>
        , incluindo os requisitos de Uso Limitado.
      </p>

      <h2 className="mt-2 text-base font-bold text-brand-black">Compartilhamento</h2>
      <p>
        Os dados não são vendidos nem compartilhados com terceiros para fins de publicidade. São processados apenas pelos serviços
        necessários ao funcionamento (hospedagem, banco de dados, WhatsApp/Telegram e inteligência artificial para leitura de
        documentos).
      </p>

      <h2 className="mt-2 text-base font-bold text-brand-black">Contato</h2>
      <p>Dúvidas ou pedidos de exclusão de dados: elyssandroo@gmail.com.</p>

      <Link href="/" className="mt-4 text-brand-red underline">
        Voltar ao OryonCash
      </Link>
    </main>
  );
}
