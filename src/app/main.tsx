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

const roteador = createBrowserRouter(rotas);
definirNavegacao((destino) => void roteador.navigate(destino, { replace: true }));

createRoot(document.getElementById("raiz")!).render(
  <StrictMode>
    <QueryClientProvider client={fila}>
      <RouterProvider router={roteador} />
    </QueryClientProvider>
  </StrictMode>,
);
