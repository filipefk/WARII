// Carta-objetivo em HTML/CSS (componente CartaObjetivo do sistema). É informação oculta: só aparece
// para o dono (e para todos no fim, a do vencedor). O texto sai dos dados do engine.
import {
  CONTINENTES,
  IDS_CONTINENTES,
  objetivo as dadosDoObjetivo,
  OBJETIVOS,
} from "@warii/engine";
import type { ReactNode } from "react";
import { TONS } from "../../ui/cores";
import { corClareadaDoContinente } from "../../ui/tokens";

// Destaques do texto: nomes de continente (na cor dele) e as metas numéricas.
const NOMES = IDS_CONTINENTES.map((c) => [CONTINENTES[c].nome, c] as const);
const DESTAQUE = new RegExp(
  `(${[...NOMES.map(([n]) => n), "\\d+ (?:territórios|centros estratégicos|exércitos)"].join("|")})`,
);

function textoDestacado(texto: string): ReactNode[] {
  return texto.split(DESTAQUE).map((pedaco, i) => {
    if (i % 2 === 0) return pedaco;
    const continente = NOMES.find(([n]) => n === pedaco)?.[1];
    return (
      <b
        key={i}
        className="font-extrabold"
        style={continente ? { color: corClareadaDoContinente(continente, 0.7) } : undefined}
      >
        {pedaco}
      </b>
    );
  });
}

function Conteudo({ id }: { id: string }) {
  const obj = dadosDoObjetivo(id);
  if (!obj) return <span>Objetivo desconhecido</span>;
  const destruir = obj.requisitos.find((r) => r.tipo === "destruirCor");
  if (destruir?.tipo === "destruirCor") {
    // "Destruir totalmente os exércitos X." + a ressalva da troca para 24 territórios.
    const [principal, ...resto] = obj.texto.split(". ");
    const palavras = (principal ?? "").split(" ");
    const cor = palavras.pop();
    return (
      <>
        <span>
          {palavras.join(" ")} <b className="font-extrabold">{cor}</b>
        </span>
        <span
          className="my-1.5 block h-[30px] w-[30px] rounded-raio-circulo border-2 shadow-sombra-ficha"
          style={{ background: TONS[destruir.cor].fundo, borderColor: "var(--color-route)" }}
        />
        <small className="mt-2 block text-[10.5px] leading-[1.3] text-objetivo-legenda">
          {resto.join(". ")}
        </small>
      </>
    );
  }
  return <span>{textoDestacado(obj.texto.replace(/\.$/, ""))}</span>;
}

// Número impresso na carta (1–20); os objetivos substitutos não têm.
function numeroDaCarta(id: string): number | null {
  const i = OBJETIVOS.findIndex((o) => o.id === id);
  return i < 0 ? null : i + 1;
}

export function CartaObjetivo({ id, largura = 170 }: { id: string; largura?: number }) {
  const numero = numeroDaCarta(id);
  return (
    <div className="carta-objetivo" style={{ width: largura }}>
      {numero !== null && <span className="carta-objetivo-numero">{numero}</span>}
      <Conteudo id={id} />
    </div>
  );
}
