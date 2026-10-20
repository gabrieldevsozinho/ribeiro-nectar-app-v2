import type { ReactNode } from "react";

function Link({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="font-semibold text-mel-texto underline underline-offset-2">
      {children}
    </a>
  );
}

function Passo({ numero, titulo, children }: { numero: number; titulo: string; children: ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-mel-claro font-bold text-mel-texto">
        {numero}
      </span>
      <div className="min-w-0 pb-1">
        <h3 className="font-semibold">{titulo}</h3>
        <div className="mt-1 flex flex-col gap-1.5 text-sm text-texto-2">{children}</div>
      </div>
    </li>
  );
}

/** Guia para a empresa criar a própria conta e chave no Google Cloud. */
export function PassoAPasso({ origem }: { origem: string }) {
  return (
    <ol className="flex flex-col gap-5">
      <Passo numero={1} titulo="Crie uma conta e um projeto no Google Cloud">
        <p>
          Entre com uma conta Google da empresa e crie um projeto (por exemplo, “Ribeiro Néctar”):{" "}
          <Link href="https://console.cloud.google.com/projectcreate">criar projeto</Link>.
        </p>
      </Passo>
      <Passo numero={2} titulo="Cadastre o cartão (faturamento)">
        <p>
          O Google exige um cartão, mesmo para usar a cota grátis mensal:{" "}
          <Link href="https://console.cloud.google.com/billing">faturamento</Link>. A cobrança do mapa vai para a sua
          empresa, direto pelo Google.
        </p>
      </Passo>
      <Passo numero={3} titulo="Ative as APIs">
        <p>No projeto, ative estas duas APIs (botão “Ativar” em cada página):</p>
        <ul className="list-disc pl-5">
          <li>
            <Link href="https://console.cloud.google.com/apis/library/maps-backend.googleapis.com">Maps JavaScript API</Link>{" "}
            — mostra o mapa
          </li>
          <li>
            <Link href="https://console.cloud.google.com/apis/library/geocoding-backend.googleapis.com">Geocoding API</Link> —
            transforma o endereço do comércio em um ponto no mapa
          </li>
        </ul>
      </Passo>
      <Passo numero={4} titulo="Crie a chave">
        <p>
          Em <Link href="https://console.cloud.google.com/google/maps-apis/credentials">credenciais</Link>, clique em
          “Criar credenciais” → “Chave de API” e copie a chave (começa com “AIza”).
        </p>
      </Passo>
      <Passo numero={5} titulo="Restrinja a chave (importante)">
        <p>Edite a chave para que só funcione no Ribeiro Néctar. Assim ninguém usa a sua cota em outro site:</p>
        <ul className="list-disc pl-5">
          <li>
            <strong className="text-texto">Restrições de aplicativo:</strong> “Sites” e adicione{" "}
            <code className="rounded bg-superficie-2 px-1.5 py-0.5 font-mono text-texto">{"https://www.ribeironectar.com.br/*"}</code>{" "}
            e <code className="rounded bg-superficie-2 px-1.5 py-0.5 font-mono text-texto">{"https://ribeironectar.com.br/*"}</code>
            {!origem.includes("ribeironectar.com.br") && (
              <>
                {" "}
                (e, neste ambiente, também{" "}
                <code className="rounded bg-superficie-2 px-1.5 py-0.5 font-mono text-texto">{`${origem}/*`}</code>)
              </>
            )}
            .
          </li>
          <li>
            <strong className="text-texto">Restrições de API:</strong> “Restringir chave” e marque só a Maps JavaScript API e
            a Geocoding API.
          </li>
        </ul>
      </Passo>
      <Passo numero={6} titulo="Crie um alerta de orçamento">
        <p>
          Em <Link href="https://console.cloud.google.com/billing/budgets">orçamentos e alertas</Link>, crie um alerta
          (por exemplo, R$ 50 por mês). No uso normal de uma empresa, o mapa fica dentro da cota grátis do Google.
        </p>
      </Passo>
      <Passo numero={7} titulo="Cole a chave aqui e teste">
        <p>O sistema confere na hora se está tudo certo e diz o que falta, se for o caso.</p>
      </Passo>
    </ol>
  );
}
