import { useRef, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { chaveCidade } from "@/compartilhado/cidades";
import { formatarCep, formatarCnpj } from "@/compartilhado/formato";
import type { CidadeCadastrada, ConfigMapaCliente, DadosPonto, EnderecoBusca, StatusLocalizacao } from "@/compartilhado/tipos";
import { UFS } from "@/compartilhado/uf";
import { api, chave, daEmpresa, lerFormulario, mensagemDe } from "../../../api";
import { ProvedorMapa } from "../../../componentes/mapa/provedor-mapa";
import { SeletorLocalizacao, type Coordenadas } from "../../../componentes/mapa/seletor-localizacao";
import { SeletorOsm } from "../../../componentes/mapa/osm/seletor-osm";
import { Aviso, Botao, Campo, Cartao, Selecao } from "../../../componentes/ui";

/** Corpo enviado à API (POST /pontos e PUT /pontos/:id): os campos do formulário e a localização. */
export type CorpoPonto = Record<string, string | number | null>;

export function FormularioPonto({
  salvar,
  mapa,
  ponto,
  rotuloEnviar,
}: {
  salvar: (corpo: CorpoPonto) => Promise<void>;
  mapa: ConfigMapaCliente;
  ponto?: DadosPonto;
  rotuloEnviar: string;
}) {
  const formulario = useRef<HTMLFormElement>(null);
  const [erro, setErro] = useState<string>();
  const [enviando, setEnviando] = useState(false);
  const [coordenadas, setCoordenadas] = useState<Coordenadas | null>(
    ponto?.latitude != null && ponto.longitude != null ? { lat: ponto.latitude, lng: ponto.longitude } : null,
  );
  const [statusLocal, setStatusLocal] = useState<StatusLocalizacao>(ponto?.localizacaoStatus ?? "pendente");
  // Cidades já cadastradas na empresa: sugeridas enquanto digita, para não repetir a mesma cidade escrita de outro jeito.
  const cidades = useQuery({
    queryKey: chave(mapa.slug, "pontos", "cidades"),
    queryFn: () => api.get<CidadeCadastrada[]>(daEmpresa(mapa.slug, "/pontos/cidades")),
    staleTime: 60_000,
  });

  const v = (campo: keyof DadosPonto, formatar?: (x: string) => string) => {
    const valor = ponto?.[campo];
    return valor == null ? "" : formatar ? formatar(String(valor)) : String(valor);
  };

  function enderecoAtual() {
    const dados = new FormData(formulario.current!);
    const t = (c: string) => String(dados.get(c) ?? "").trim();
    return [[t("logradouro"), t("numero")].filter(Boolean).join(", "), t("bairro"), [t("cidade"), t("uf")].filter(Boolean).join(" - "), t("cep"), "Brasil"]
      .filter(Boolean)
      .join(", ");
  }

  /** Os campos do endereço como estão agora no formulário (para o Nominatim, que busca por partes). */
  function enderecoBusca(): EnderecoBusca {
    const dados = new FormData(formulario.current!);
    const t = (c: string) => String(dados.get(c) ?? "").trim();
    return { logradouro: t("logradouro"), numero: t("numero"), bairro: t("bairro"), cidade: t("cidade"), uf: t("uf"), cep: t("cep") };
  }

  /**
   * Cidade já cadastrada escrita de outro jeito ("santa vitoria"): troca pela grafia da empresa
   * ("Santa Vitória") e, se o estado estiver vazio, preenche. O servidor confere de novo ao salvar.
   */
  function usarGrafiaCadastrada() {
    const campos = formulario.current!.elements;
    const cidade = campos.namedItem("cidade") as HTMLInputElement;
    const uf = campos.namedItem("uf") as HTMLSelectElement;
    if (!cidade.value.trim()) return;
    const iguais = (cidades.data ?? []).filter(
      (c) => chaveCidade(c.cidade, "") === chaveCidade(cidade.value, "") && (!uf.value || c.uf === uf.value),
    );
    if (iguais.length !== 1) return;
    cidade.value = iguais[0]!.cidade;
    if (!uf.value) uf.value = iguais[0]!.uf;
  }

  function aoMudarLocalizacao(novas: Coordenadas, status: StatusLocalizacao | "automatica" | "ajustada") {
    setCoordenadas(novas);
    setStatusLocal(status);
  }

  async function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setEnviando(true);
    setErro(undefined);
    try {
      await salvar({
        ...lerFormulario(evento.currentTarget),
        latitude: coordenadas?.lat ?? null,
        longitude: coordenadas?.lng ?? null,
        localizacaoStatus: statusLocal,
      });
    } catch (e) {
      setErro(mensagemDe(e));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form ref={formulario} onSubmit={aoEnviar} className="flex max-w-3xl flex-col gap-5">
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      <Cartao className="flex flex-col gap-4">
        <h2 className="font-titulo text-lg font-bold">Comércio</h2>
        <Campo rotulo="Nome do comércio" name="nome" defaultValue={v("nome")} required placeholder="Empório Bela Vista" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo rotulo="CNPJ (opcional)" name="cnpj" inputMode="numeric" defaultValue={v("cnpj", formatarCnpj)} />
          <Campo rotulo="Contato" name="contato" defaultValue={v("contato")} placeholder="Nome de quem atende" />
          <Campo rotulo="Telefone" name="telefone" type="tel" defaultValue={v("telefone")} />
        </div>
      </Cartao>

      <Cartao className="flex flex-col gap-4">
        <h2 className="font-titulo text-lg font-bold">Endereço</h2>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
          <Campo
            rotulo="Rua / avenida"
            name="logradouro"
            defaultValue={v("logradouro")}
            required
            placeholder="Av. Brasil"
            dica="Com o tipo: Rua, Av., Rodovia… Sem ele, o mapa e a rota podem não achar o endereço."
          />
          <Campo rotulo="Número" name="numero" defaultValue={v("numero")} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Bairro" name="bairro" defaultValue={v("bairro")} />
          <Campo rotulo="CEP" name="cep" inputMode="numeric" defaultValue={v("cep", formatarCep)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
          <Campo
            rotulo="Cidade"
            name="cidade"
            defaultValue={v("cidade")}
            required
            list="cidades-cadastradas"
            autoComplete="off"
            onBlur={usarGrafiaCadastrada}
          />
          <datalist id="cidades-cadastradas">
            {(cidades.data ?? []).map((c) => (
              <option key={`${c.cidade}|${c.uf}`} value={c.cidade} label={c.uf} />
            ))}
          </datalist>
          <Selecao rotulo="UF" name="uf" defaultValue={v("uf") || ""} required>
            <option value="" disabled>
              —
            </option>
            {UFS.map((uf) => (
              <option key={uf}>{uf}</option>
            ))}
          </Selecao>
        </div>
      </Cartao>

      <Cartao className="flex flex-col gap-3">
        <h2 className="font-titulo text-lg font-bold">Localização no mapa</h2>
        <ProvedorMapa config={mapa} altura="h-48">
          {mapa.provedor === "osm" ? (
            <SeletorOsm slug={mapa.slug} coordenadas={coordenadas} enderecoBusca={enderecoBusca} aoMudar={aoMudarLocalizacao} />
          ) : (
            <SeletorLocalizacao slug={mapa.slug} coordenadas={coordenadas} enderecoAtual={enderecoAtual} aoMudar={aoMudarLocalizacao} />
          )}
        </ProvedorMapa>
      </Cartao>

      <div>
        <Botao type="submit" disabled={enviando}>
          {enviando ? "Salvando…" : rotuloEnviar}
        </Botao>
      </div>
    </form>
  );
}
