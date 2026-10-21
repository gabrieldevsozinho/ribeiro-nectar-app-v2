/** Prazos de visita do mapa: o master define em quantos dias um comércio fica em dia, em atenção ou atrasado. */
import { eq } from "drizzle-orm";
import { PRAZO_MAXIMO_DIAS } from "@/compartilhado/semaforo";
import type { PrazosVisita } from "@/compartilhado/tipos";
import type { Db } from "../db/cliente";
import { empresas } from "../db/esquema";
import { ErroDeNegocio } from "../erros";
import type { UsuarioDaEmpresa } from "../tipos";

export async function obterPrazos(db: Db, u: UsuarioDaEmpresa): Promise<PrazosVisita | null> {
  const linha = await db
    .select({ emDia: empresas.prazoEmDiaDias, atencao: empresas.prazoAtencaoDias })
    .from(empresas)
    .where(eq(empresas.id, u.empresa.id))
    .get();
  return linha?.emDia != null && linha.atencao != null ? { emDia: linha.emDia, atencao: linha.atencao } : null;
}

const lerDias = (texto: string) => (/^\d{1,4}$/.test(texto) ? Number(texto) : null);

export async function salvarPrazos(db: Db, u: UsuarioDaEmpresa, entrada: { emDia: string; atencao: string }): Promise<string> {
  const emDia = lerDias(entrada.emDia);
  const atencao = lerDias(entrada.atencao);
  if (emDia === null || emDia < 1) throw new ErroDeNegocio("Informe até quantos dias o comércio fica em dia (um número a partir de 1).");
  if (atencao === null) throw new ErroDeNegocio("Informe até quantos dias o comércio fica em atenção.");
  if (atencao <= emDia) throw new ErroDeNegocio("O prazo de atenção precisa ser maior que o prazo em dia.");
  if (atencao > PRAZO_MAXIMO_DIAS) throw new ErroDeNegocio(`Use no máximo ${PRAZO_MAXIMO_DIAS} dias (10 anos).`);

  await db.update(empresas).set({ prazoEmDiaDias: emDia, prazoAtencaoDias: atencao }).where(eq(empresas.id, u.empresa.id));
  return "Prazos salvos.";
}
