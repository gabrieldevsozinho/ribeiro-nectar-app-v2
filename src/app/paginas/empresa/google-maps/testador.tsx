import { useRef, useState } from "react";
import { mascararChave, type ResultadoTesteMaps } from "@/compartilhado/google-maps-erros";
import { api, chave, daEmpresa, fila, mensagemDe } from "../../../api";
import { Aviso, Botao } from "../../../componentes/ui";

type Estado = { erro?: string; sucesso?: string };

/** Roda o teste num iframe novo e devolve o resultado. */
function testarNoNavegador(chaveMaps: string, container: HTMLElement): Promise<ResultadoTesteMaps> {
  return new Promise((resolver) => {
    const iframe = document.createElement("iframe");
    iframe.src = "/api/teste-google-maps";
    iframe.title = "Teste do Google Maps";
    iframe.style.cssText = "position:absolute;width:240px;height:160px;opacity:0;pointer-events:none;left:-9999px";

    const aoReceber = (evento: MessageEvent) => {
      if (evento.origin !== window.location.origin || evento.source !== iframe.contentWindow) return;
      if (evento.data?.tipo === "testador-maps-pronto") {
        iframe.contentWindow?.postMessage({ tipo: "testar-chave-maps", chave: chaveMaps }, window.location.origin);
      } else if (evento.data?.tipo === "resultado-teste-maps") {
        window.removeEventListener("message", aoReceber);
        iframe.remove();
        const { ok, codigo, detalhe } = evento.data;
        resolver(ok ? { ok: true } : { ok: false, codigo: String(codigo), detalhe: detalhe ? String(detalhe) : undefined });
      }
    };
    window.addEventListener("message", aoReceber);
    container.appendChild(iframe);
  });
}

export function TestadorChave({ slug, chaveAtual }: { slug: string; chaveAtual: string | null }) {
  const [valor, setValor] = useState("");
  const [estado, setEstado] = useState<Estado>({});
  const [testando, setTestando] = useState(false);
  const area = useRef<HTMLDivElement>(null);

  const recarregar = () => fila.invalidateQueries({ queryKey: chave(slug) });

  async function testarESalvar(chaveMaps: string) {
    if (!area.current) return;
    setTestando(true);
    setEstado({});
    try {
      const resultado = await testarNoNavegador(chaveMaps.trim(), area.current);
      // Uma chave que falhou também é guardada (como "com erro"): o master corrige no Google Cloud e testa de novo.
      const resposta = await api.put<{ sucesso: string }>(daEmpresa(slug, "/google-maps"), {
        chave: chaveMaps,
        resultado,
        origem: window.location.origin,
      });
      setEstado({ sucesso: resposta.sucesso });
      setValor("");
    } catch (e) {
      setEstado({ erro: mensagemDe(e) });
    } finally {
      setTestando(false);
      void recarregar();
    }
  }

  return (
    <div ref={area} className="relative flex flex-col gap-4">
      {estado.erro && (
        <Aviso tipo="erro" titulo="A chave não funcionou">
          {estado.erro}
        </Aviso>
      )}
      {estado.sucesso && (
        <Aviso tipo="sucesso" titulo="Tudo certo">
          {estado.sucesso}
        </Aviso>
      )}

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (valor.trim()) void testarESalvar(valor);
        }}
      >
        <label htmlFor="chave" className="text-sm font-semibold">
          {chaveAtual ? "Trocar por outra chave" : "Cole aqui a chave da sua empresa"}
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="chave"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="AIza…"
            autoComplete="off"
            spellCheck={false}
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-borda-forte bg-superficie px-3.5 font-mono text-base md:text-[15px] focus:border-mel"
          />
          <Botao type="submit" disabled={testando || !valor.trim()}>
            {testando ? "Testando com o Google…" : "Testar e salvar"}
          </Botao>
        </div>
        <p className="text-sm text-texto-3">O sistema carrega um mapa e localiza um endereço de teste com a sua chave. Leva alguns segundos.</p>
      </form>

      {chaveAtual && (
        <div className="flex flex-wrap items-center gap-2 border-t border-borda pt-4 text-sm">
          <span className="text-texto-2">
            Chave salva: <span className="font-mono text-texto">{mascararChave(chaveAtual)}</span>
          </span>
          <Botao
            type="button"
            variante="secundario"
            className="min-h-9 px-3 text-sm"
            disabled={testando}
            onClick={() => void testarESalvar(chaveAtual)}
          >
            Testar de novo
          </Botao>
          <Botao
            type="button"
            variante="fantasma"
            className="min-h-9 px-3 text-sm"
            disabled={testando}
            onClick={async () => {
              if (!window.confirm("Remover a chave? O mapa fica desligado para toda a empresa.")) return;
              try {
                setEstado({ sucesso: (await api.delete<{ sucesso: string }>(daEmpresa(slug, "/google-maps"))).sucesso });
              } catch (e) {
                setEstado({ erro: mensagemDe(e) });
              }
              void recarregar();
            }}
          >
            Remover chave
          </Botao>
        </div>
      )}
    </div>
  );
}
