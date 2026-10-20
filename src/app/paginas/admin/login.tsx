import { Navigate, useNavigate, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { MOTIVOS_SAIDA } from "@/compartilhado/mensagens";
import type { UsuarioLogado } from "@/compartilhado/tipos";
import { api, fila } from "../../api";
import { FormularioLogin } from "../../componentes/formulario-login";
import { TelaAcesso } from "../../componentes/tela-acesso";
import { Aviso, useTitulo } from "../../componentes/ui";

export default function PaginaLoginAdmin() {
  useTitulo("Painel da plataforma");
  const navegar = useNavigate();
  const motivo = useSearchParams()[0].get("motivo") ?? undefined;
  const sessao = useQuery({
    queryKey: ["sessao"],
    queryFn: () => api.get<{ estado: string; usuario?: UsuarioLogado }>("/api/sessao"),
    staleTime: 0,
  });

  if (sessao.data?.usuario?.papel === "admin_plataforma") return <Navigate to="/admin/empresas" replace />;
  const aviso = motivo ? MOTIVOS_SAIDA[motivo] : undefined;

  return (
    <TelaAcesso rodape="Acesso restrito à Gabriel Studio.">
      <p className="text-sm font-semibold uppercase tracking-[0.12em] text-mel-texto">Plataforma</p>
      <h1 className="mt-1 font-titulo text-2xl font-bold tracking-tight">Painel do administrador</h1>
      <div className="mt-5 flex flex-col gap-4">
        {aviso && (
          <Aviso tipo={motivo === "saiu" ? "info" : "alerta"} titulo={aviso.titulo}>
            {aviso.texto}
          </Aviso>
        )}
        <FormularioLogin
          enviar={async ({ email, senha }) => {
            const { destino } = await api.post<{ destino: string }>("/api/sessao/entrar-admin", { email, senha });
            fila.clear();
            navegar(destino, { replace: true });
          }}
        />
      </div>
    </TelaAcesso>
  );
}
