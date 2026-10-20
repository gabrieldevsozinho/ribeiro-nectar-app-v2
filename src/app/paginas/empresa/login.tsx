import { Navigate, useNavigate, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { MOTIVOS_SAIDA } from "@/compartilhado/mensagens";
import type { EmpresaPublica, UsuarioLogado } from "@/compartilhado/tipos";
import { api, fila } from "../../api";
import { FormularioLogin } from "../../componentes/formulario-login";
import { TelaAcesso } from "../../componentes/tela-acesso";
import { Aviso, Carregando, useTitulo } from "../../componentes/ui";
import NaoEncontrado from "../nao-encontrado";
import { useSlug } from "./contexto";

type EstadoSessao = { estado: "ok"; usuario: UsuarioLogado } | { estado: string };

export default function PaginaLogin() {
  useTitulo("Entrar");
  const slug = useSlug();
  const navegar = useNavigate();
  const motivo = useSearchParams()[0].get("motivo") ?? undefined;

  const empresa = useQuery({
    queryKey: ["publico", "empresa", slug],
    queryFn: () => api.get<EmpresaPublica>(`/api/publico/empresas/${slug}`),
  });
  const sessao = useQuery({ queryKey: ["sessao"], queryFn: () => api.get<EstadoSessao>("/api/sessao"), staleTime: 0 });

  if (empresa.isError && (empresa.error as { status?: number }).status === 404) return <NaoEncontrado />;

  // Já está logado nesta empresa: vai direto para dentro.
  const logado = sessao.data && "usuario" in sessao.data ? sessao.data.usuario : null;
  if (logado && logado.empresa?.slug === slug) {
    return <Navigate to={logado.deveTrocarSenha ? `/${slug}/primeiro-acesso` : `/${slug}/vendas`} replace />;
  }

  const aviso = motivo ? MOTIVOS_SAIDA[motivo] : undefined;

  return (
    <TelaAcesso rodape="Esqueceu a senha? Fale com o responsável da sua empresa.">
      {!empresa.data ? (
        <Carregando />
      ) : (
        <>
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-mel-texto">Entrar</p>
          <h1 className="mt-1 font-titulo text-2xl font-bold tracking-tight">{empresa.data.nome}</h1>
          <div className="mt-5 flex flex-col gap-4">
            {!empresa.data.ativa && (
              <Aviso tipo="alerta" titulo="Empresa desativada">
                O acesso desta empresa está suspenso. Fale com a Gabriel Studio.
              </Aviso>
            )}
            {aviso && (
              <Aviso tipo={motivo === "saiu" ? "info" : "alerta"} titulo={aviso.titulo}>
                {aviso.texto}
              </Aviso>
            )}
            <FormularioLogin
              enviar={async ({ email, senha }) => {
                const { destino } = await api.post<{ destino: string }>("/api/sessao/entrar", { slug, email, senha });
                // Outro usuário pode ter usado este aparelho: nada do cache anterior vale.
                fila.clear();
                navegar(destino, { replace: true });
              }}
            />
          </div>
        </>
      )}
    </TelaAcesso>
  );
}
