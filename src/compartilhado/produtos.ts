/**
 * Categorias de produto são por empresa: cada master cria e exclui as suas (não é uma lista
 * fixa do sistema). Toda empresa nasce com este conjunto inicial — comum em apiários (mel por
 * florada, própolis, pólen, geleia real, cera, favo, hidromel, cosméticos, kits) —, que o
 * master edita livremente dali em diante.
 */
export const DEFAULT_CATEGORIAS_PRODUTO = [
  "Mel",
  "Mel cremoso",
  "Favo de mel",
  "Própolis",
  "Pólen",
  "Geleia real",
  "Cera de abelha",
  "Hidromel",
  "Cosmético",
  "Kit / combo",
  "Outro",
];

/**
 * Unidades iniciais de uma empresa nova (o master edita ou exclui dali em diante). São os tamanhos
 * mais comuns num apiário; a lista completa fica em unidades_produto, por empresa.
 */
export const DEFAULT_UNIDADES_PRODUTO = [
  "pote 500 g",
  "pote 1 kg",
  "bisnaga 280 g",
  "bisnaga 500 g",
  "vidro 450 g",
  "vidro 750 g",
  "frasco 30 ml",
  "frasco 60 ml",
  "favo 200 g",
  "kg",
  "unidade",
];
