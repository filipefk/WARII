// Endurecimento HTTP da API: cabeçalhos de segurança (@fastify/helmet) e só JSON como corpo.
// A API só responde JSON e nunca é aberta como página: a CSP dela bloqueia tudo. A CSP do site
// (o SPA) fica no Nginx do pacote web. Não há CORS: sem Access-Control-Allow-Origin, o navegador
// não deixa outra origem ler as respostas, e a origem das escritas é conferida em origem.ts.
// O Socket.IO atende /socket.io antes do Fastify, então estes cabeçalhos não valem para ele.
import helmet from "@fastify/helmet";
import type { FastifyInstance } from "fastify";
import { config } from "./config.js";

// Corpo máximo aceito em qualquer rota (as rotas ainda declaram limites menores).
export const LIMITE_CORPO_GLOBAL = 16 * 1024;

const UM_ANO_EM_SEGUNDOS = 365 * 24 * 60 * 60;

export async function registrarSeguranca(app: FastifyInstance): Promise<void> {
  await app.register(helmet, {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    // HTTPS só em produção (o Traefik termina o TLS); em dev o site é http://localhost.
    strictTransportSecurity:
      config.NODE_ENV === "production"
        ? { maxAge: UM_ANO_EM_SEGUNDOS, includeSubDomains: false }
        : false,
    frameguard: { action: "deny" },
    crossOriginResourcePolicy: { policy: "same-origin" },
    referrerPolicy: { policy: "no-referrer" },
  });

  // O Fastify aceita text/plain por padrão: é o tipo que um <form> de outro site consegue enviar
  // sem preflight. Só JSON passa (os outros tipos recebem 415).
  app.removeContentTypeParser("text/plain");
}
