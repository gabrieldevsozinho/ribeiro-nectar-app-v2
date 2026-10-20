import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { Perfil } from "@/compartilhado/tipos";
import { api, chave, daEmpresa, fila, lerFormulario } from "../../api";
import { Aviso, Botao, Campo, Carregando, Cartao, ErroCarregar, TituloPagina, useTitulo } from "../../componentes/ui";
import { useUsuario } from "./contexto";

export default function PaginaPerfil() {
  useTitulo("Meu perfil");
  const usuario = useUsuario();
  const slug = usuario.empresa.slug;
  const perfil = useQuery({ queryKey: chave(slug, "perfil"), queryFn: () => api.get<Perfil>(daEmpresa(slug, "/perfil")) });

  return (
    <>
      <TituloPagina titulo="Meu perfil" />
      {perfil.isError ? (
        <ErroCarregar erro={perfil.error} aoTentar={() => perfil.refetch()} />
      ) : !perfil.data ? (
        <Carregando />
      ) : (
        <div className="grid max-w-4xl gap-5 lg:grid-cols-2">
          <Cartao>
            <h2 className="font-titulo text-lg font-bold">Meus dados</h2>
            <p className="mt-1 text-sm text-texto-2">
              {perfil.data.email} · {usuario.papel === "master" ? "Master" : "Revendedor"} de {usuario.empresa.nome}
            </p>
            <FormularioDados slug={slug} ehMaster={usuario.papel === "master"} perfil={perfil.data} />
          </Cartao>
          <Cartao>
            <h2 className="font-titulo text-lg font-bold">Trocar senha</h2>
            <p className="mt-1 text-sm text-texto-2">Ninguém da empresa tem acesso à sua senha.</p>
            <FormularioSenha slug={slug} />
          </Cartao>
        </div>
      )}
    </>
  );
}

function FormularioDados({ slug, ehMaster, perfil }: { slug: string; ehMaster: boolean; perfil: Perfil }) {
  const salvar = useMutation({
    mutationFn: (dados: { nome: string; telefone: string; endereco: string; compartilhaVendas?: boolean }) =>
      api.put<{ sucesso: string }>(daEmpresa(slug, "/perfil"), dados),
    // O nome aparece no menu: recarrega os dados do usuário também.
    onSuccess: () => fila.invalidateQueries({ queryKey: chave(slug) }),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const dados = lerFormulario(e.currentTarget);
        salvar.mutate({
          nome: dados.nome,
          telefone: dados.telefone,
          endereco: dados.endereco,
          ...(ehMaster ? { compartilhaVendas: dados.compartilha_vendas === "on" } : {}),
        });
      }}
      className="mt-4 flex flex-col gap-4"
    >
      {salvar.isError && <Aviso tipo="erro">{salvar.error.message}</Aviso>}
      {salvar.isSuccess && <Aviso tipo="sucesso">{salvar.data.sucesso}</Aviso>}
      <Campo rotulo="Nome" name="nome" defaultValue={perfil.nome} required />
      <Campo rotulo="Telefone" name="telefone" type="tel" defaultValue={perfil.telefone ?? ""} />
      <Campo rotulo="Endereço" name="endereco" defaultValue={perfil.endereco ?? ""} />

      {ehMaster && (
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-borda bg-superficie-2 p-3.5">
          <input
            type="checkbox"
            name="compartilha_vendas"
            defaultChecked={perfil.compartilhaVendas}
            className="mt-1 size-5 shrink-0 accent-[var(--color-mel)]"
          />
          <span>
            <span className="block font-semibold">Compartilhar minhas vendas com os outros masters</span>
            <span className="block text-sm text-texto-2">
              Desligado, as vendas que você registra não aparecem para os outros masters da empresa.
            </span>
          </span>
        </label>
      )}

      <div>
        <Botao type="submit" disabled={salvar.isPending}>
          {salvar.isPending ? "Salvando…" : "Salvar"}
        </Botao>
      </div>
    </form>
  );
}

function FormularioSenha({ slug }: { slug: string }) {
  // A cada troca bem-sucedida o formulário volta vazio.
  const [versao, setVersao] = useState(0);
  const trocar = useMutation({
    mutationFn: (dados: Record<string, string>) =>
      api.post<{ sucesso: string }>(daEmpresa(slug, "/perfil/senha"), {
        senhaAtual: dados.senha_atual,
        senhaNova: dados.senha_nova,
        confirmacao: dados.confirmacao,
      }),
    onSuccess: () => setVersao((v) => v + 1),
  });

  return (
    <form
      key={versao}
      onSubmit={(e) => {
        e.preventDefault();
        trocar.mutate(lerFormulario(e.currentTarget));
      }}
      className="mt-4 flex flex-col gap-4"
    >
      {trocar.isError && <Aviso tipo="erro">{trocar.error.message}</Aviso>}
      {trocar.isSuccess && <Aviso tipo="sucesso">{trocar.data.sucesso}</Aviso>}
      <Campo rotulo="Senha atual" name="senha_atual" type="password" autoComplete="current-password" required />
      <Campo
        rotulo="Nova senha"
        name="senha_nova"
        type="password"
        autoComplete="new-password"
        dica="Pelo menos 8 caracteres, com letras e números."
        minLength={8}
        required
      />
      <Campo rotulo="Repita a nova senha" name="confirmacao" type="password" autoComplete="new-password" required />
      <div>
        <Botao type="submit" variante="secundario" disabled={trocar.isPending}>
          {trocar.isPending ? "Trocando…" : "Trocar senha"}
        </Botao>
      </div>
    </form>
  );
}
