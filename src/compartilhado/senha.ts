/** Regras de senha do sistema. */
export function validarSenha(senha: string): string | null {
  if (senha.length < 8) return "A senha precisa ter pelo menos 8 caracteres.";
  if (senha.length > 128) return "A senha pode ter no máximo 128 caracteres.";
  if (!/[A-Za-z]/.test(senha) || !/[0-9]/.test(senha)) return "Use letras e números na senha.";
  return null;
}

// Sem letras parecidas (l, I, O, 0) para facilitar ditar a senha por telefone.
const LETRAS = "abcdefghjkmnpqrstuvwxyz";
const NUMEROS = "23456789";

function sortear(conjunto: string): string {
  const indice = crypto.getRandomValues(new Uint32Array(1))[0] % conjunto.length;
  return conjunto[indice];
}

/** Senha temporária fácil de ditar, ex.: "favo-7k3m-92". */
export function gerarSenhaTemporaria(): string {
  const palavras = ["favo", "mel", "abelha", "flor", "polen", "nectar", "colmeia"];
  const palavra = palavras[crypto.getRandomValues(new Uint32Array(1))[0] % palavras.length];
  const meio = Array.from({ length: 4 }, (_, i) => sortear(i % 2 ? LETRAS : NUMEROS)).join("");
  const fim = sortear(NUMEROS) + sortear(NUMEROS);
  return `${palavra}-${meio}-${fim}`;
}
