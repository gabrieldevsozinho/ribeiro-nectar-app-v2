export const FUSO = "America/Sao_Paulo";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const numero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });
const data = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric" });
const dataHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatarMoeda(valor: number | string | null | undefined): string {
  return moeda.format(Number(valor ?? 0));
}

export function formatarNumero(valor: number | string | null | undefined): string {
  return numero.format(Number(valor ?? 0));
}

export function formatarData(valor: string | Date | null | undefined): string {
  return valor ? data.format(new Date(valor)) : "—";
}

export function formatarDataHora(valor: string | Date | null | undefined): string {
  return valor ? dataHora.format(new Date(valor)) : "—";
}

/** Para comparar textos digitados: sem acento, maiúsculas nem espaços sobrando ("  São  Paulo" = "sao paulo"). */
export function paraComparar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** "1 venda", "3 vendas" */
export function contar(quantidade: number, singular: string, plural: string): string {
  return `${quantidade} ${quantidade === 1 ? singular : plural}`;
}

/** Só os dígitos de CNPJ, CEP e telefone. */
export function somenteDigitos(texto: string): string {
  return texto.replace(/\D/g, "");
}

export function formatarCnpj(cnpj: string | null | undefined): string {
  if (!cnpj || cnpj.length !== 14) return cnpj ?? "";
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

export function formatarCep(cep: string | null | undefined): string {
  if (!cep || cep.length !== 8) return cep ?? "";
  return cep.replace(/^(\d{5})(\d{3})$/, "$1-$2");
}

/** Lê um valor em reais digitado como "45", "45,90" ou "1.234,50". */
export function lerValorEmReais(texto: string): number | null {
  const limpo = texto.trim().replace(/\s|R\$/g, "");
  if (!limpo) return null;
  const normalizado = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  const valor = Number(normalizado);
  return Number.isFinite(valor) ? Math.round(valor * 100) / 100 : null;
}

/** Lê uma quantidade como "2", "1,5" ou "0.5". */
export function lerQuantidade(texto: string): number | null {
  const valor = Number(texto.trim().replace(",", "."));
  return Number.isFinite(valor) ? valor : null;
}

/**
 * O banco guarda dinheiro em centavos e quantidade em milésimos (números inteiros),
 * para não acumular erro de arredondamento. A API conversa em reais e unidades.
 */
export const paraCentavos = (reais: number) => Math.round(reais * 100);
export const deCentavos = (centavos: number | null | undefined) => Number(centavos ?? 0) / 100;
export const paraMilesimos = (quantidade: number) => Math.round(quantidade * 1000);
export const deMilesimos = (milesimos: number | null | undefined) => Number(milesimos ?? 0) / 1000;

/** Mesmo cálculo da coluna itens_venda.subtotal_centavos, para mostrar o total antes de salvar. */
export function subtotalEmReais(quantidade: number, precoUnitario: number): number {
  return Math.round((paraMilesimos(quantidade) * paraCentavos(precoUnitario)) / 1000) / 100;
}
