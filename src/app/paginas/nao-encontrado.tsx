import { TelaAcesso } from "../componentes/tela-acesso";
import { BotaoLink, useTitulo } from "../componentes/ui";

export default function NaoEncontrado() {
  useTitulo("Página não encontrada");
  return (
    <TelaAcesso>
      <h1 className="font-titulo text-2xl font-bold tracking-tight">Página não encontrada</h1>
      <p className="mt-2 text-sm text-texto-2">Confira o endereço. Se for o endereço da sua empresa, fale com o responsável por ela.</p>
      <BotaoLink to="/" className="mt-5 w-full">
        Ir para o início
      </BotaoLink>
    </TelaAcesso>
  );
}
