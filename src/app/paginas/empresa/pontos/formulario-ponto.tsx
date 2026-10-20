import { useRef, useState, type FormEvent } from "react";
import { formatarCep, formatarCnpj } from "@/compartilhado/formato";
import type { ConfigMapaCliente, DadosPonto, EnderecoBusca, StatusLocalizacao } from "@/compartilhado/tipos";
import { UFS } from "@/compartilhado/uf";
import { lerFormulario, mensagemDe } from "../../../api";
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
          <Campo rotulo="Rua / avenida" name="logradouro" defaultValue={v("logradouro")} required />
          <Campo rotulo="Número" name="numero" defaultValue={v("numero")} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Bairro" name="bairro" defaultValue={v("bairro")} />
          <Campo rotulo="CEP" name="cep" inputMode="numeric" defaultValue={v("cep", formatarCep)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
          <Campo rotulo="Cidade" name="cidade" defaultValue={v("cidade")} required />
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
