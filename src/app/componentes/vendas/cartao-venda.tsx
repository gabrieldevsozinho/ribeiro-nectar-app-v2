import { Link } from "react-router";
import { formatarDataHora, formatarMoeda, formatarNumero } from "@/compartilhado/formato";
import type { VendaResumo } from "@/compartilhado/tipos";

/** Uma venda com o que foi vendido, quando, para quem, por quanto e por quem. */
export function CartaoVenda({
  venda,
  slug,
  mostrarPonto = true,
}: {
  venda: VendaResumo;
  slug: string;
  mostrarPonto?: boolean;
}) {
  return (
    <Link
      to={`/${slug}/vendas/${venda.id}`}
      className="block rounded-xl border border-borda bg-superficie px-4 py-3 transition-colors hover:border-borda-forte"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {mostrarPonto && <p className="truncate font-semibold">{venda.ponto.nome}</p>}
          <p className="text-sm text-texto-2">
            {formatarDataHora(venda.dataVenda)} · {venda.vendedor}
            {mostrarPonto && venda.ponto.cidade && ` · ${venda.ponto.cidade}/${venda.ponto.uf}`}
          </p>
        </div>
        <span className="shrink-0 font-bold">{formatarMoeda(venda.valorTotal)}</span>
      </div>
      <ul className="mt-1.5 text-sm text-texto-2">
        {venda.itens.map((item, i) => (
          <li key={i} className="flex justify-between gap-3">
            <span className="min-w-0 truncate">
              {formatarNumero(item.quantidade)} × {item.produto} <span className="text-texto-3">({item.unidade})</span>
            </span>
            <span className="shrink-0">{formatarMoeda(item.subtotal)}</span>
          </li>
        ))}
      </ul>
    </Link>
  );
}
