// Formato das ações do jogo (as intenções que o cliente envia pelo socket, etapa 7).
// Espelha o tipo `Acao` do engine (packages/engine/src/regras/acoes.ts): o schema só garante o
// formato; quem decide se a ação vale no estado atual é sempre aplicarAcao().
import { type Acao, CARTAS_DE_TROCA, type CartaId, IDS_TERRITORIOS } from "@warii/engine";
import { z } from "zod";

// Tetos generosos: só existem para recusar números absurdos antes de chegarem ao engine.
const MAXIMO_EXERCITOS = 9_999;
const MAXIMO_DADOS = 3;
const MAXIMO_BOMBARDEIROS = 99;
const MAXIMO_CARTAS = CARTAS_DE_TROCA.length;

const idsCartas: CartaId[] = CARTAS_DE_TROCA.map((c) => c.id);

export const esquemaTerritorio = z.enum(IDS_TERRITORIOS, {
  error: "território inexistente",
});
export const esquemaCarta = z.enum(idsCartas, { error: "carta inexistente" });

const inteiro = (minimo: number, maximo: number) => z.int().min(minimo).max(maximo);
const listaDeCartas = z.array(esquemaCarta).max(MAXIMO_CARTAS);

export const esquemaAcao = z.discriminatedUnion("tipo", [
  z.strictObject({ tipo: z.literal("pegarCentroExtra"), carta: esquemaCarta }),
  z.strictObject({
    tipo: z.literal("ocuparDoisVagos"),
    territorios: z.tuple([esquemaTerritorio, esquemaTerritorio]),
  }),
  z.strictObject({ tipo: z.literal("ocupar"), territorio: esquemaTerritorio }),
  z.strictObject({
    tipo: z.literal("posicionar"),
    territorio: esquemaTerritorio,
    quantidade: inteiro(1, MAXIMO_EXERCITOS),
  }),
  z.strictObject({ tipo: z.literal("encerrarRecebimento") }),
  z.strictObject({
    tipo: z.literal("atacar"),
    origem: esquemaTerritorio,
    alvo: esquemaTerritorio,
    dados: inteiro(1, MAXIMO_DADOS),
  }),
  z.strictObject({ tipo: z.literal("moverAposConquista"), quantidade: inteiro(1, MAXIMO_DADOS) }),
  z.strictObject({
    tipo: z.literal("iniciarAtaqueAereo"),
    alvo: esquemaTerritorio,
    daBase: inteiro(0, MAXIMO_BOMBARDEIROS),
    cartas: z.strictObject({ carta: esquemaCarta, numericas: listaDeCartas }).optional(),
  }),
  z.strictObject({ tipo: z.literal("continuarAtaqueAereo") }),
  z.strictObject({ tipo: z.literal("encerrarAtaqueAereo") }),
  z.strictObject({ tipo: z.literal("encerrarAtaques") }),
  z.strictObject({
    tipo: z.literal("deslocar"),
    origem: esquemaTerritorio,
    destino: esquemaTerritorio,
    quantidade: inteiro(1, MAXIMO_EXERCITOS),
  }),
  z.strictObject({
    tipo: z.literal("reforcarComCartas"),
    carta: esquemaCarta,
    territorio: esquemaTerritorio,
    numericas: listaDeCartas,
  }),
  z.strictObject({
    tipo: z.literal("transportarComCartas"),
    cartas: z.tuple([esquemaCarta, esquemaCarta]),
    origem: esquemaTerritorio,
    destino: esquemaTerritorio,
    quantidade: inteiro(1, MAXIMO_EXERCITOS),
  }),
  z.strictObject({ tipo: z.literal("descartar"), cartas: listaDeCartas.min(1) }),
  z.strictObject({ tipo: z.literal("encerrarJogada") }),
]);

export type AcaoEntrada = z.infer<typeof esquemaAcao>;

// Conferências em tempo de compilação: o schema não pode divergir do engine.
// 1) toda ação aceita pelo schema é uma `Acao` válida para o engine;
// 2) o schema cobre exatamente os mesmos tipos de ação.
type Igual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const acaoCompativel: AcaoEntrada extends Acao ? true : false = true;
const mesmosTipos: Igual<AcaoEntrada["tipo"], Acao["tipo"]> = true;
void acaoCompativel;
void mesmosTipos;
