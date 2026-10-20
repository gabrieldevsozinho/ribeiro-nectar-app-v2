import { useState, type FormEvent } from "react";
import { lerFormulario, mensagemDe } from "../api";
import { Aviso, Botao, Campo } from "./ui";

type Enviar = (dados: Record<string, string>) => Promise<void>;

/** Envia o formulário e mostra o erro, se houver (o sucesso fica a cargo de quem chama). */
function useEnvio(enviar: Enviar) {
  const [erro, setErro] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  async function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setEnviando(true);
    setErro(undefined);
    try {
      await enviar(lerFormulario(evento.currentTarget));
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setEnviando(false);
    }
  }
  return { erro, enviando, aoEnviar };
}

export function FormularioLogin({ enviar }: { enviar: Enviar }) {
  const { erro, enviando, aoEnviar } = useEnvio(enviar);

  return (
    <form onSubmit={aoEnviar} className="flex flex-col gap-4">
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <Campo rotulo="E-mail" name="email" type="email" autoComplete="email" inputMode="email" required />
      <Campo rotulo="Senha" name="senha" type="password" autoComplete="current-password" required />
      <Botao type="submit" disabled={enviando} className="mt-1">
        {enviando ? "Entrando…" : "Entrar"}
      </Botao>
    </form>
  );
}

export function FormularioNovaSenha({ enviar }: { enviar: Enviar }) {
  const { erro, enviando, aoEnviar } = useEnvio(enviar);

  return (
    <form onSubmit={aoEnviar} className="flex flex-col gap-4">
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <Campo
        rotulo="Nova senha"
        name="senha"
        type="password"
        autoComplete="new-password"
        dica="Pelo menos 8 caracteres, com letras e números."
        required
        minLength={8}
      />
      <Campo rotulo="Repita a nova senha" name="confirmacao" type="password" autoComplete="new-password" required />
      <Botao type="submit" disabled={enviando} className="mt-1">
        {enviando ? "Salvando…" : "Salvar e continuar"}
      </Botao>
    </form>
  );
}
