import type { StatusGoogleMaps } from "@/compartilhado/tipos";
import { Selo } from "../../componentes/ui";

export function SeloGoogleMaps({ status }: { status: StatusGoogleMaps }) {
  if (status === "valida") return <Selo tipo="sucesso">Maps configurado</Selo>;
  if (status === "com_erro") return <Selo tipo="erro">Maps com erro</Selo>;
  return <Selo tipo="alerta">Maps pendente</Selo>;
}
