// Regra única de origem para o REST (métodos que alteram dados) e para o handshake do Socket.IO,
// a defesa contra CSRF e contra WebSocket entre sites (além do cookie SameSite=Lax):
// - com `Origin`, só a do site (URL_PUBLICA) passa — "null" (iframe isolado etc.) é recusado;
// - sem `Origin` (o navegador o omite em GET da mesma origem, como o polling do Socket.IO), vale o
//   `Sec-Fetch-Site`, que nenhuma página consegue forjar: só "same-origin" ou "none" passam;
// - sem os dois, não é um navegador (curl, testes); sem o cookie de outro site, não há CSRF.
import type { IncomingHttpHeaders } from "node:http";
import { config } from "./config.js";

const SITES_ACEITOS = new Set(["same-origin", "none"]);

export function origemPermitida(cabecalhos: IncomingHttpHeaders): boolean {
  const origem = cabecalhos.origin;
  if (origem !== undefined) return origem === config.URL_PUBLICA;
  const site = cabecalhos["sec-fetch-site"];
  if (site !== undefined) return typeof site === "string" && SITES_ACEITOS.has(site);
  return true;
}
