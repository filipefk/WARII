// Peças pequenas de interface reaproveitadas pelas telas, no sistema de design War II Online
// (tokens e classes .botao/.campo/.secao/.tag em index.css).
import { CORES, type CorId } from "@warii/engine";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { TONS } from "../ui/cores";

// Não existe botão "primário" colorido: a ação em destaque é a primeira da linha. `ativo` é a
// aba ou o filtro selecionado.
export function Botao({
  ocupado = false,
  ativo = false,
  className = "",
  disabled,
  children,
  ...resto
}: ButtonHTMLAttributes<HTMLButtonElement> & { ocupado?: boolean; ativo?: boolean }) {
  return (
    <button
      type="button"
      {...resto}
      disabled={disabled === true || ocupado}
      className={`botao ${ativo ? "ativo" : ""} ${className}`}
    >
      {ocupado ? "Aguarde…" : children}
    </button>
  );
}

export function Campo({
  rotulo,
  dica,
  ...resto
}: InputHTMLAttributes<HTMLInputElement> & { rotulo: string; dica?: string }) {
  return (
    <label className="block">
      <span className="mb-espaco-1 block">{rotulo}</span>
      <input {...resto} className="campo w-full" />
      {dica && <span className="dica mt-espaco-1 block">{dica}</span>}
    </label>
  );
}

// Aviso no painel: a cor vai no texto e a mensagem sempre diz o que aconteceu (nunca só a cor).
export function Aviso({
  tipo = "erro",
  children,
}: {
  tipo?: "erro" | "info" | "sucesso";
  children: ReactNode;
}) {
  const cor = { erro: "text-bad", info: "text-text", sucesso: "text-good" }[tipo];
  return (
    <div
      role={tipo === "erro" ? "alert" : "status"}
      className={`rounded-raio-md border border-border bg-panel-2 px-espaco-4 py-espaco-3 ${cor}`}
    >
      {children}
    </div>
  );
}

export function Carregando({ texto = "Carregando…" }: { texto?: string }) {
  return <p className="dica py-8 text-center">{texto}</p>;
}

// Bloco de painel: `panel`, borda `border`, título `secao`.
export function Cartao({ titulo, children }: { titulo?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-raio-md border border-border bg-panel/90 p-espaco-7">
      {titulo && <h2 className="secao mb-espaco-3">{titulo}</h2>}
      {children}
    </section>
  );
}

// Título da tela (estilo `titulo`) com uma linha de apoio opcional.
export function TituloDaTela({ titulo, apoio }: { titulo: ReactNode; apoio?: ReactNode }) {
  return (
    <div>
      <h1 className="text-titulo">{titulo}</h1>
      {apoio && <p className="dica">{apoio}</p>}
    </div>
  );
}

// Presença: ponto colorido sempre acompanhado da palavra.
export function Presenca({ online, textos }: { online: boolean; textos: [string, string] }) {
  return (
    <span className="dica inline-flex items-center gap-espaco-1">
      <span
        className={`inline-block h-2 w-2 rounded-raio-circulo ${online ? "bg-good" : "bg-border"}`}
      />
      {online ? textos[0] : textos[1]}
    </span>
  );
}

// Amostra de cor do jogador: sempre com contorno (o preto quase some sobre bg).
export function CorJogador({ cor, tamanho = "w-4 h-4" }: { cor: CorId | null; tamanho?: string }) {
  if (cor === null) {
    return (
      <span
        title="Sem cor"
        className={`inline-block rounded-raio-circulo border border-dashed border-muted ${tamanho}`}
      />
    );
  }
  return (
    <span
      title={CORES[cor].nome}
      className={`inline-block rounded-raio-circulo border border-[#888] ${tamanho}`}
      style={{ backgroundColor: TONS[cor].fundo }}
    />
  );
}

// Botão só com o ícone: o nome vai na dica (title) e no rótulo para leitores de tela.
export function BotaoIcone({
  dica,
  onClick,
  children,
}: {
  dica: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" className="botao" title={dica} aria-label={dica} onClick={onClick}>
      {children}
    </button>
  );
}
