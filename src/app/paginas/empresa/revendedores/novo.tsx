import { useState } from "react";
import { Navigate } from "react-router";
import { useMutation } from "@tanstack/react-query";
import type { ResultadoAcao } from "@/compartilhado/tipos";
import { api, chave, daEmpresa, fila, lerFormulario } from "../../../api";
import { CampoSenhaTemporaria, CredencialCriada } from "../../../componentes/senha-temporaria";
import { Aviso, Botao, BotaoLink, Campo, Cartao, LinkVoltar, TituloPagina, useTitulo } from "../../../componentes/ui";
import { useUsuario } from "../contexto";

export default function PaginaNovoRevendedor() {
  useTitulo("Cadastrar revendedor");
  const usuario = useUsuario();
  const slug = usuario.empresa.slug;
  // A cada cadastro, "Cadastrar outro" recomeça o formulário do zero.
  const [versao, setVersao] = useState(0);

  if (usuario.papel !== "master") return <Navigate to={`/${slug}/vendas`} replace />;

  return (
    <>
      <LinkVoltar para={`/${slug}/revendedores`}>Revendedores</LinkVoltar>
      <TituloPagina
        titulo="Cadastrar revendedor"
        descricao="Ele recebe uma senha temporária e cria a própria senha no primeiro acesso. Você não terá acesso à conta dele."
      />
      <FormularioNovoRevendedor key={versao} slug={slug} aoRecomecar={() => setVersao((v) => v + 1)} />
    </>
  );
}

function FormularioNovoRevendedor({ slug, aoRecomecar }: { slug: string; aoRecomecar: () => void }) {
  const criar = useMutation({
    mutationFn: (dados: Record<string, string>) => api.post<ResultadoAcao>(daEmpresa(slug, "/revendedores"), dados),
    onSuccess: () => fila.invalidateQueries({ queryKey: chave(slug, "revendedores") }),
  });

  if (criar.data?.credencial) {
    return (
      <div className="flex max-w-2xl flex-col gap-4">
        <CredencialCriada titulo={criar.data.sucesso ?? "Revendedor cadastrado"} {...criar.data.credencial} />
        <div className="flex flex-wrap gap-2">
          <BotaoLink to={`/${slug}/revendedores`}>Ver revendedores</BotaoLink>
          <Botao type="button" variante="secundario" onClick={aoRecomecar}>
            Cadastrar outro
          </Botao>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        criar.mutate(lerFormulario(e.currentTarget));
      }}
      className="max-w-2xl"
    >
      <Cartao className="flex flex-col gap-4">
        {criar.isError && <Aviso tipo="erro">{criar.error.message}</Aviso>}
        <Campo rotulo="Nome" name="nome" required autoComplete="off" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="E-mail" name="email" type="email" required autoComplete="off" />
          <Campo rotulo="Telefone" name="telefone" type="tel" placeholder="(16) 99999-0000" />
        </div>
        <Campo rotulo="Endereço" name="endereco" placeholder="Rua, número – cidade/UF" />
        <CampoSenhaTemporaria />
        <div>
          <Botao type="submit" disabled={criar.isPending}>
            {criar.isPending ? "Cadastrando…" : "Cadastrar revendedor"}
          </Botao>
        </div>
      </Cartao>
    </form>
  );
}
