// Rotas /api/usuarios: por ora só a foto do avatar, lida por quem está logado (a URL leva a
// versão, então a resposta fica em cache para sempre). Enviar ou remover a foto: /api/auth/avatar
// (a própria) e /api/admin/usuarios/:id/avatar (de qualquer usuário).
import { esquemaIdUsuario } from "@warii/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { exigirSessao } from "../auth/plugin.js";
import { responderErro } from "../erros.js";
import { lerAvatar } from "./avatar.js";

const LIMITE_LEITURA = { max: 600, timeWindow: "1 minute" };
const UM_ANO_EM_SEGUNDOS = 365 * 24 * 60 * 60;

const ParametroUsuario = z.object({ id: esquemaIdUsuario });

export async function rotasDeUsuarios(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", exigirSessao);

  app.get(
    "/:id/avatar",
    { config: { rateLimit: LIMITE_LEITURA } },
    async (requisicao, resposta) => {
      const params = ParametroUsuario.safeParse(requisicao.params);
      const avatar = params.success ? await lerAvatar(params.data.id) : undefined;
      if (!avatar) return responderErro(resposta, 404, "SEM_AVATAR", "usuário sem avatar");
      return resposta
        .header("content-type", avatar.tipo)
        .header("cache-control", `private, max-age=${UM_ANO_EM_SEGUNDOS}, immutable`)
        .send(avatar.imagem);
    },
  );
}
