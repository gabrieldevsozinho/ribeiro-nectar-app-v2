import { useState } from "react";
import { gerarSenhaTemporaria } from "@/compartilhado/senha";
import type { Credencial } from "@/compartilhado/tipos";
import { Aviso } from "./ui";

/** Campo de senha temporária com botão para gerar uma senha fácil de ditar. */
export function CampoSenhaTemporaria({ name = "senha", rotulo = "Senha temporária" }: { name?: string; rotulo?: string }) {
  const [valor, setValor] = useState("");

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-semibold text-texto">
        {rotulo}
      </label>
      <div className="flex gap-2">
        <input
          id={name}
          name={name}
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          required
          minLength={8}
          autoComplete="off"
          spellCheck={false}
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-borda-forte bg-superficie px-3.5 font-mono text-base md:text-[15px] focus:border-mel"
        />
        <button
          type="button"
          onClick={() => setValor(gerarSenhaTemporaria())}
          className="min-h-11 shrink-0 rounded-xl border border-borda-forte px-3.5 text-sm font-semibold text-texto hover:bg-superficie-2"
        >
          Gerar
        </button>
      </div>
      <p className="text-sm text-texto-3">O usuário troca esta senha no primeiro acesso.</p>
    </div>
  );
}

/** Mostra, uma única vez, o login criado para ser repassado ao usuário. */
export function CredencialCriada({ titulo, email, senha, endereco }: Credencial & { titulo: string }) {
  const [copiado, setCopiado] = useState(false);
  const enderecoCompleto = endereco ? `${window.location.origin}${endereco}` : undefined;
  const textoParaCopiar = [enderecoCompleto && `Endereço: ${enderecoCompleto}`, `E-mail: ${email}`, `Senha temporária: ${senha}`]
    .filter(Boolean)
    .join("\n");

  return (
    <Aviso tipo="sucesso" titulo={titulo}>
      <p>Passe estes dados para o usuário. A senha não será mostrada de novo.</p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-texto">
        {enderecoCompleto && (
          <>
            <dt className="text-texto-2">Endereço</dt>
            <dd className="font-mono break-all">{enderecoCompleto}</dd>
          </>
        )}
        <dt className="text-texto-2">E-mail</dt>
        <dd className="font-mono break-all">{email}</dd>
        <dt className="text-texto-2">Senha</dt>
        <dd className="font-mono">{senha}</dd>
      </dl>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(textoParaCopiar);
          setCopiado(true);
        }}
        className="mt-3 rounded-lg border border-sucesso/40 px-3 py-1.5 text-sm font-semibold hover:bg-sucesso/10"
      >
        {copiado ? "Copiado!" : "Copiar dados"}
      </button>
    </Aviso>
  );
}
