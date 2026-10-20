import { useState } from "react";
import { useParams } from "react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { formatarDataHora } from "@/compartilhado/formato";
import type { EmpresaDetalhe, ResultadoAcao } from "@/compartilhado/tipos";
import { api, fila, lerFormulario } from "../../api";
import { CampoSenhaTemporaria, CredencialCriada } from "../../componentes/senha-temporaria";
import { Aviso, Botao, Campo, Carregando, Cartao, ErroCarregar, LinkVoltar, Selo, TituloPagina, useTitulo } from "../../componentes/ui";
import { SeloGoogleMaps } from "./selo-google-maps";

const recarregar = () => fila.invalidateQueries({ queryKey: ["admin"] });

export default function PaginaEmpresa() {
  useTitulo("Empresa");
  const id = useParams().id ?? "";
  const consulta = useQuery({ queryKey: ["admin", "empresas", id], queryFn: () => api.get<EmpresaDetalhe>(`/api/admin/empresas/${id}`) });

  if (consulta.isError) {
    return (
      <>
        <LinkVoltar para="/admin/empresas">Empresas</LinkVoltar>
        <ErroCarregar erro={consulta.error} aoTentar={() => consulta.refetch()} />
      </>
    );
  }
  if (!consulta.data) return <Carregando />;

  const empresa = consulta.data;
  const podeAdicionarMaster = empresa.emUso.masters < empresa.limiteMasters;

  return (
    <>
      <LinkVoltar para="/admin/empresas">Empresas</LinkVoltar>
      <TituloPagina
        titulo={empresa.nome}
        descricao={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">/{empresa.slug}</span>
            {empresa.ativa ? <Selo tipo="sucesso">Ativa</Selo> : <Selo tipo="erro">Desativada</Selo>}
            <SeloGoogleMaps status={empresa.maps.status} />
          </span>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Cartao>
          <h2 className="font-titulo text-lg font-bold">Dados e plano</h2>
          <p className="mt-1 text-sm text-texto-2">
            Em uso: {empresa.emUso.masters} de {empresa.limiteMasters} masters e {empresa.emUso.revendedores} de {empresa.limiteRevendedores}{" "}
            revendedores.
          </p>
          <FormularioDadosEmpresa empresa={empresa} />
        </Cartao>

        <div className="flex flex-col gap-5">
          <Cartao>
            <h2 className="font-titulo text-lg font-bold">Google Maps</h2>
            <p className="mt-1 text-sm text-texto-2">
              Cada empresa cadastra a própria chave, com a conta e o cartão dela. Por aqui você vê só o status, nunca a chave.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <SeloGoogleMaps status={empresa.maps.status} />
              {empresa.maps.validadaEm && <span className="text-texto-2">validada em {formatarDataHora(empresa.maps.validadaEm)}</span>}
            </div>
            {empresa.maps.status === "com_erro" && empresa.maps.ultimoErro && (
              <p className="mt-2 text-sm text-erro">Último erro: {empresa.maps.ultimoErro}</p>
            )}
          </Cartao>

          <Cartao>
            <h2 className="font-titulo text-lg font-bold">Acesso da empresa</h2>
            <p className="mt-1 text-sm text-texto-2">
              Desativada, ninguém da empresa consegue entrar. Os dados continuam guardados e voltam ao reativar.
            </p>
            <div className="mt-4">
              <BotaoAtivarEmpresa empresaId={empresa.id} ativa={empresa.ativa} />
            </div>
          </Cartao>
        </div>
      </div>

      <Cartao className="mt-5">
        <h2 className="font-titulo text-lg font-bold">Masters</h2>
        <ul className="mt-3 divide-y divide-borda">
          {empresa.masters.map((m) => (
            <LinhaMaster key={m.id} empresaId={empresa.id} master={m} podeExcluir={empresa.emUso.masters > 1} />
          ))}
        </ul>

        <div className="mt-4 border-t border-borda pt-4">
          {podeAdicionarMaster ? (
            <AdicionarMaster empresaId={empresa.id} />
          ) : (
            <p className="text-sm text-texto-2">
              Limite de {empresa.limiteMasters} masters atingido. Aumente o limite do plano para cadastrar outro.
            </p>
          )}
        </div>
      </Cartao>
    </>
  );
}

type Master = EmpresaDetalhe["masters"][number];

/**
 * Um master da empresa, com "Editar" e "Excluir". As vendas e tudo que ele cadastrou continuam
 * ligados ao cadastro dele: trocar e-mail ou senha não afasta nada do histórico.
 */
function LinhaMaster({ empresaId, master, podeExcluir }: { empresaId: string; master: Master; podeExcluir: boolean }) {
  const [editando, setEditando] = useState(false);
  const salvar = useMutation({
    mutationFn: (d: Record<string, string>) => api.put<ResultadoAcao>(`/api/admin/empresas/${empresaId}/masters/${master.id}`, d),
    onSuccess: async (resposta) => {
      await recarregar();
      // Com senha nova, a tela continua aberta mostrando os dados do login (aparecem uma única vez).
      if (!resposta.credencial) setEditando(false);
    },
  });
  const excluir = useMutation({
    mutationFn: () => api.delete<{ sucesso: string }>(`/api/admin/empresas/${empresaId}/masters/${master.id}`),
    onSuccess: recarregar,
  });

  if (editando) {
    if (salvar.data?.credencial) {
      return (
        <li className="flex max-w-xl flex-col gap-3 py-3">
          <CredencialCriada titulo={salvar.data.sucesso ?? "Master atualizado"} {...salvar.data.credencial} />
          <div>
            <Botao
              type="button"
              variante="secundario"
              onClick={() => {
                salvar.reset();
                setEditando(false);
              }}
            >
              Fechar
            </Botao>
          </div>
        </li>
      );
    }
    return (
      <li className="py-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            salvar.mutate(lerFormulario(e.currentTarget));
          }}
          className="flex max-w-xl flex-col gap-4"
        >
          <h3 className="font-semibold">Editar {master.nome}</h3>
          {salvar.isError && <Aviso tipo="erro">{salvar.error.message}</Aviso>}
          <Campo rotulo="Nome" name="nome" defaultValue={master.nome} required />
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="E-mail" name="email" type="email" defaultValue={master.email ?? ""} required />
            <Campo rotulo="Telefone (opcional)" name="telefone" type="tel" defaultValue={master.telefone ?? ""} />
          </div>
          <Aviso tipo="info">
            Trocar o e-mail ou a senha desconecta o master de onde ele estiver logado. As vendas e os cadastros dele continuam no
            sistema, ligados a ele.
          </Aviso>
          <CampoSenhaTemporaria rotulo="Nova senha temporária (deixe em branco para manter a atual)" obrigatorio={false} />
          <div className="flex gap-2">
            <Botao type="submit" disabled={salvar.isPending}>
              {salvar.isPending ? "Salvando…" : "Salvar"}
            </Botao>
            <Botao
              type="button"
              variante="fantasma"
              onClick={() => {
                salvar.reset();
                setEditando(false);
              }}
            >
              Cancelar
            </Botao>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-3">
      <div className="min-w-0">
        <p className="font-semibold">{master.nome}</p>
        <p className="text-sm text-texto-2 break-all">
          {master.email}
          {master.telefone && ` · ${master.telefone}`}
        </p>
        {excluir.isError && <p className="text-sm text-erro">{excluir.error.message}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {master.bloqueado && <Selo tipo="erro">Bloqueado</Selo>}
        {master.deveTrocarSenha && <Selo tipo="alerta">Ainda não fez o primeiro acesso</Selo>}
        <Botao type="button" variante="fantasma" className="min-h-9 px-3 text-sm" onClick={() => setEditando(true)}>
          Editar
        </Botao>
        <Botao
          type="button"
          variante="fantasma"
          className="min-h-9 px-3 text-sm text-erro"
          disabled={excluir.isPending || !podeExcluir}
          title={podeExcluir ? undefined : "A empresa precisa ter pelo menos 1 master"}
          onClick={() => {
            if (window.confirm(`Excluir ${master.nome}? O login é apagado; as vendas dele continuam no histórico como “Master removido”.`)) {
              excluir.mutate();
            }
          }}
        >
          {excluir.isPending ? "Excluindo…" : "Excluir"}
        </Botao>
      </div>
    </li>
  );
}

function FormularioDadosEmpresa({ empresa }: { empresa: EmpresaDetalhe }) {
  const salvar = useMutation({
    mutationFn: (d: Record<string, string>) =>
      api.put<{ sucesso: string }>(`/api/admin/empresas/${empresa.id}`, {
        nome: d.nome,
        limiteMasters: d.limite_masters,
        limiteRevendedores: d.limite_revendedores,
      }),
    onSuccess: recarregar,
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        salvar.mutate(lerFormulario(e.currentTarget));
      }}
      className="mt-4 flex flex-col gap-4"
    >
      {salvar.isError && <Aviso tipo="erro">{salvar.error.message}</Aviso>}
      {salvar.isSuccess && <Aviso tipo="sucesso">{salvar.data.sucesso}</Aviso>}
      <Campo rotulo="Nome da empresa" name="nome" defaultValue={empresa.nome} required />
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Limite de masters" name="limite_masters" type="number" min={1} defaultValue={empresa.limiteMasters} required />
        <Campo rotulo="Limite de revendedores" name="limite_revendedores" type="number" min={0} defaultValue={empresa.limiteRevendedores} required />
      </div>
      <div>
        <Botao type="submit" variante="secundario" disabled={salvar.isPending}>
          {salvar.isPending ? "Salvando…" : "Salvar alterações"}
        </Botao>
      </div>
    </form>
  );
}

function BotaoAtivarEmpresa({ empresaId, ativa }: { empresaId: string; ativa: boolean }) {
  const alternar = useMutation({
    mutationFn: () => api.patch(`/api/admin/empresas/${empresaId}/ativa`, { ativo: !ativa }),
    onSuccess: recarregar,
  });

  return (
    <div className="flex flex-col gap-3">
      {alternar.isError && <Aviso tipo="erro">{alternar.error.message}</Aviso>}
      <div>
        <Botao
          type="button"
          variante={ativa ? "perigo" : "primario"}
          disabled={alternar.isPending}
          onClick={() => {
            const pergunta = ativa ? "Desativar a empresa? Ninguém dela conseguirá entrar até você reativar." : "Reativar a empresa?";
            if (window.confirm(pergunta)) alternar.mutate();
          }}
        >
          {alternar.isPending ? "Salvando…" : ativa ? "Desativar empresa" : "Reativar empresa"}
        </Botao>
      </div>
    </div>
  );
}

function AdicionarMaster({ empresaId }: { empresaId: string }) {
  const [aberto, setAberto] = useState(false);
  const adicionar = useMutation({
    mutationFn: (d: Record<string, string>) => api.post<ResultadoAcao>(`/api/admin/empresas/${empresaId}/masters`, d),
    onSuccess: recarregar,
  });

  if (adicionar.data?.credencial) {
    return <CredencialCriada titulo={adicionar.data.sucesso ?? "Master cadastrado"} {...adicionar.data.credencial} />;
  }

  if (!aberto && !adicionar.isError) {
    return (
      <Botao type="button" variante="secundario" onClick={() => setAberto(true)}>
        Cadastrar outro master
      </Botao>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        adicionar.mutate(lerFormulario(e.currentTarget));
      }}
      className="flex max-w-xl flex-col gap-4"
    >
      <h3 className="font-semibold">Novo master</h3>
      {adicionar.isError && <Aviso tipo="erro">{adicionar.error.message}</Aviso>}
      <Campo rotulo="Nome" name="nome" required />
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="E-mail" name="email" type="email" required />
        <Campo rotulo="Telefone (opcional)" name="telefone" type="tel" />
      </div>
      <CampoSenhaTemporaria />
      <div className="flex gap-2">
        <Botao type="submit" disabled={adicionar.isPending}>
          {adicionar.isPending ? "Cadastrando…" : "Cadastrar master"}
        </Botao>
        <Botao
          type="button"
          variante="fantasma"
          onClick={() => {
            adicionar.reset();
            setAberto(false);
          }}
        >
          Cancelar
        </Botao>
      </div>
    </form>
  );
}
