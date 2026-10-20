import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { QueryClientProvider } from "@tanstack/react-query";
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource/raleway/600.css";
import "@fontsource/raleway/700.css";
import "@fontsource/raleway/800.css";
import "./estilos.css";
import { definirNavegacao, fila } from "./api";
import { rotas } from "./rotas";

// Depois de uma publicação, os arquivos das telas ganham nomes novos. Quem estava com o sistema aberto
// ainda procura os nomes antigos, que não existem mais: o Vite avisa por este evento. Recarregamos a página
// uma vez para pegar a versão nova (o marcador evita um ciclo de recarregamentos se o problema for outro).
window.addEventListener("vite:preloadError", (evento) => {
  evento.preventDefault();
  try {
    if (sessionStorage.getItem("recarregou-versao-nova")) return;
    sessionStorage.setItem("recarregou-versao-nova", "1");
  } catch {
    return;
  }
  window.location.reload();
});
// Carregou bem: a próxima publicação pode usar o recarregamento de novo.
window.addEventListener("load", () => {
  try {
    sessionStorage.removeItem("recarregou-versao-nova");
  } catch {
    // sem armazenamento: sem marcador, nada a limpar
  }
});

const roteador = createBrowserRouter(rotas);
definirNavegacao((destino) => void roteador.navigate(destino, { replace: true }));

createRoot(document.getElementById("raiz")!).render(
  <StrictMode>
    <QueryClientProvider client={fila}>
      <RouterProvider router={roteador} />
    </QueryClientProvider>
  </StrictMode>,
);
