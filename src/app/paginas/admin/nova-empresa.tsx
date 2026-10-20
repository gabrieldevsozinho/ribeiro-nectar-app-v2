import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { normalizarSlug } from "@/compartilhado/slug";
import type { ResultadoAcao } from "@/compartilhado/tipos";
import { api, fila, lerFormulario } from "../../api";
import { CampoSenhaTemporaria, CredencialCriada } from "../../componentes/senha-temporaria";
import { Aviso, Botao, BotaoLink, Campo, Cartao, LinkVoltar, TituloPagina, useTitulo } from "../../componentes/ui";

export default function PaginaNovaEmpresa() {
  useTitulo("Nova empresa");
  // "Cadastrar outra" recomeça o formulário do zero.
  const [versao, setVersao] = useState(0);
  return (
    <>
      <LinkVoltar para="/admin/empresas">Empresas</LinkVoltar>
      <TituloPagina
        titulo="Nova empresa"
        descricao="Cadastre a empresa e o primeiro master. Ele recebe uma senha temporária e troca no primeiro acesso."
      />
      <FormularioNovaEmpresa key={versao} aoRecomecar={() => setVersao((v) => v + 1)} />
    </>
  );
}

function FormularioNovaEmpresa({ aoRecomecar }: { aoRecomecar: () => void }) {
  const [nome, setNome] = useState("");
  const [slugEditado, setSlugEditado] = useState<string | null>(null);
  const slug = slugEditado ?? normalizarSlug(nome);

  const criar = useMutation({
    mutationFn: (d: Record<string, string>) =>
      api.post<ResultadoAcao>("/api/admin/empresas", {
        nome: d.nome,
        slug: d.slug,
        limiteMasters: d.limite_masters,
        limiteRevendedores: d.limite_revendedores,
        master: { nome: d.master_nome, email: d.master_email, telefone: d.master_telefone, senha: d.master_senha },
      }),
    onSuccess: () => fila.invalidateQueries({ queryKey: ["admin"] }),
  });

  if (criar.data?.credencial) {
    return (
      <div className="flex max-w-2xl flex-col gap-4">
        <CredencialCriada titulo={criar.data.sucesso ?? "Empresa cadastrada"} {...criar.data.credencial} />
        <div className="flex flex-wrap gap-2">
          <BotaoLink to="/admin/empresas">Ver empresas</BotaoLink>
          <Botao type="button" variante="secundario" onClick={aoRecomecar}>
            Cadastrar outra
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
      className="flex max-w-2xl flex-col gap-5"
    >
      {criar.isError && <Aviso tipo="erro">{criar.error.message}</Aviso>}

      <Cartao className="flex flex-col gap-4">
        <h2 className="font-titulo text-lg font-bold">Empresa</h2>
        <Campo rotulo="Nome da empresa" name="nome" required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Apiário Exemplo" />
        <Campo
          rotulo="Endereço no sistema"
          name="slug"
          required
          value={slug}
          onChange={(e) => setSlugEditado(normalizarSlug(e.target.value))}
          dica={
            <>
              A empresa acessa em ribeironectar.com.br/<strong>{slug || "endereco"}</strong>
            </>
          }
          spellCheck={false}
          autoCapitalize="none"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Limite de masters" name="limite_masters" type="number" min={1} defaultValue="3" required />
          <Campo rotulo="Limite de revendedores" name="limite_revendedores" type="number" min={0} defaultValue="10" required />
        </div>
        <p className="-mt-1 text-sm text-texto-3">Plano inicial: até 3 masters e 10 revendedores. Acima disso, valor à parte.</p>
      </Cartao>

      <Cartao className="flex flex-col gap-4">
        <h2 className="font-titulo text-lg font-bold">Master inicial</h2>
        <Campo rotulo="Nome" name="master_nome" required placeholder="Maria Souza" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="E-mail" name="master_email" type="email" required />
          <Campo rotulo="Telefone (opcional)" name="master_telefone" type="tel" />
        </div>
        <CampoSenhaTemporaria name="master_senha" />
      </Cartao>

      <div>
        <Botao type="submit" disabled={criar.isPending}>
          {criar.isPending ? "Cadastrando…" : "Cadastrar empresa"}
        </Botao>
      </div>
    </form>
  );
}
