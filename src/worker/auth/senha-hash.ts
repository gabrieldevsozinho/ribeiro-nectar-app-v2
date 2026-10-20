/**
 * Hash de senha com PBKDF2-SHA256 (Web Crypto nativo do Workers).
 *
 * O Better Auth usa scrypt em JavaScript por padrão, que estoura o limite de CPU
 * do Workers. O PBKDF2 roda nativo; 100 mil iterações é o máximo que o runtime aceita.
 * Formato guardado: pbkdf2-sha256$<iterações>$<sal base64>$<hash base64>
 *
 * Só usa APIs padrão (crypto.subtle), então também roda no Node (scripts de seed e admin).
 */
const ITERACOES = 100_000;
const BYTES_SAL = 16;
const BYTES_HASH = 32;
const PREFIXO = "pbkdf2-sha256";

const paraBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const deBase64 = (texto: string) => Uint8Array.from(atob(texto), (c) => c.charCodeAt(0));

async function derivar(senha: string, sal: Uint8Array, iteracoes: number, bytes: number): Promise<Uint8Array> {
  const chave = await crypto.subtle.importKey("raw", new TextEncoder().encode(senha.normalize("NFKC")), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: sal as BufferSource, iterations: iteracoes },
    chave,
    bytes * 8,
  );
  return new Uint8Array(bits);
}

/** Compara sem atalhos, para o tempo de resposta não revelar quantos bytes batem. */
function iguais(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diferenca = 0;
  for (let i = 0; i < a.length; i++) diferenca |= a[i] ^ b[i];
  return diferenca === 0;
}

export async function gerarHashSenha(senha: string): Promise<string> {
  const sal = crypto.getRandomValues(new Uint8Array(BYTES_SAL));
  const hash = await derivar(senha, sal, ITERACOES, BYTES_HASH);
  return `${PREFIXO}$${ITERACOES}$${paraBase64(sal)}$${paraBase64(hash)}`;
}

export async function conferirSenha({ hash, password }: { hash: string; password: string }): Promise<boolean> {
  const [prefixo, iteracoes, sal, esperado] = hash.split("$");
  const n = Number(iteracoes);
  if (prefixo !== PREFIXO || !Number.isInteger(n) || n < 1 || n > ITERACOES || !sal || !esperado) return false;
  try {
    const bytesEsperados = deBase64(esperado);
    const calculado = await derivar(password, deBase64(sal), n, bytesEsperados.length);
    return iguais(calculado, bytesEsperados);
  } catch {
    return false;
  }
}
