/**
 * A cidade do ponto é digitada à mão: "Santa Vitória", "Santa Vitoria" e "santa vitória"
 * são a mesma cidade. Estas funções comparam sem acento, maiúsculas nem espaços sobrando,
 * e escolhem a grafia que fica.
 */
import { paraComparar } from "./formato";

const semAcento = (texto: string) => texto.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Espaços sobrando viram um só: " Santa  Vitória " → "Santa Vitória". */
export function limparCidade(cidade: string): string {
  return cidade.replace(/\s+/g, " ").trim();
}

/** Chave de comparação: ("Santa Vitória", "MG") → "santa vitoria|MG". */
export function chaveCidade(cidade: string, uf: string): string {
  return `${paraComparar(cidade)}|${uf.trim().toUpperCase()}`;
}

const acentos = (texto: string) => texto.normalize("NFD").length - semAcento(texto).length;

/** 2 = "Santa Vitória", 1 = "SANTA VITÓRIA", 0 = "santa vitória". */
function capitalizacao(texto: string) {
  if (texto === texto.toLowerCase()) return 0;
  return texto === texto.toUpperCase() ? 1 : 2;
}

/**
 * Entre grafias da mesma cidade, fica a mais completa: com acentos, depois com iniciais
 * maiúsculas e, no empate, a mais usada (e, se ainda empatar, a que veio primeiro).
 */
export function melhorGrafia(grafias: { cidade: string; usos: number }[]): string {
  const ordenadas = [...grafias].sort(
    (a, b) => acentos(b.cidade) - acentos(a.cidade) || capitalizacao(b.cidade) - capitalizacao(a.cidade) || b.usos - a.usos,
  );
  return ordenadas[0]?.cidade ?? "";
}
