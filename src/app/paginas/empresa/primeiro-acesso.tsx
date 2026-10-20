import { Navigate, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import type { UsuarioLogado } from "@/compartilhado/tipos";
import { api, chave, daEmpresa, fila } from "../../api";
import { FormularioNovaSenha } from "../../componentes/formulario-login";
import { TelaAcesso } from "../../componentes/tela-acesso";
import { Carregando, useTitulo } from "../../componentes/ui";
import { useSlug } from "./contexto";

export default function PaginaPrimeiroAcesso() {
  useTitulo("Primeiro acesso");
  const slug = useSlug();
  const navegar = useNavigate();
  const eu = useQuery({ queryKey: chave(slug, "eu"), queryFn: () => api.get<UsuarioLogado>(daEmpresa(slug, "/eu")) });

  if (eu.data && !eu.data.deveTrocarSenha) return <Navigate to={`/${slug}/vendas`} replace />;

  return (
    <TelaAcesso rodape="Ninguém da empresa, nem o master, vê a sua senha.">
      {!eu.data ? (
        <Carregando />
      ) : (
        <>
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-mel-texto">Primeiro acesso</p>
          <h1 className="mt-1 font-titulo text-2xl font-bold tracking-tight">Olá, {eu.data.nome.split(" ")[0]}!</h1>
          <p className="mt-2 text-sm text-texto-2">Antes de começar, crie a sua própria senha. A senha temporária deixa de valer.</p>
          <div className="mt-5">
            <FormularioNovaSenha
              enviar={async (dados) => {
                const { destino } = await api.post<{ destino: string }>(daEmpresa(slug, "/primeiro-acesso"), dados);
                await fila.invalidateQueries({ queryKey: chave(slug, "eu") });
                navegar(destino, { replace: true });
              }}
            />
          </div>
        </>
      )}
    </TelaAcesso>
  );
}
