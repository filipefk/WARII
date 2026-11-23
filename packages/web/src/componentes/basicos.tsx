// Peças pequenas de interface reaproveitadas pelas telas.
import { CORES, type CorId } from "@warii/engine";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { TONS } from "../ui/cores";

type Variante = "primario" | "secundario" | "perigo";

const CLASSES_VARIANTE: Record<Variante, string> = {
  primario: "bg-amber-500 text-slate-950 hover:bg-amber-400",
  secundario: "bg-slate-700 text-slate-100 hover:bg-slate-600",
  perigo: "bg-red-700 text-white hover:bg-red-600",
};

export function Botao({
  variante = "primario",
  ocupado = false,
  className = "",
  disabled,
  children,
  ...resto
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; ocupado?: boolean }) {
  return (
    <button
      type="button"
      {...resto}
      disabled={disabled === true || ocupado}
      className={`rounded px-3 py-1.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${CLASSES_VARIANTE[variante]} ${className}`}
    >
      {ocupado ? "aguarde…" : children}
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
      <span className="mb-1 block text-sm text-slate-300">{rotulo}</span>
      <input
        {...resto}
        className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 outline-none focus:border-amber-500 disabled:opacity-60"
      />
      {dica && <span className="mt-1 block text-xs text-slate-400">{dica}</span>}
    </label>
  );
}

export function Aviso({
  tipo = "erro",
  children,
}: {
  tipo?: "erro" | "info" | "sucesso";
  children: ReactNode;
}) {
  const cores = {
    erro: "border-red-700 bg-red-950/60 text-red-200",
    info: "border-sky-700 bg-sky-950/60 text-sky-200",
    sucesso: "border-emerald-700 bg-emerald-950/60 text-emerald-200",
  }[tipo];
  return (
    <div role={tipo === "erro" ? "alert" : "status"} className={`rounded border px-3 py-2 text-sm ${cores}`}>
      {children}
    </div>
  );
}

export function Carregando({ texto = "carregando…" }: { texto?: string }) {
  return <p className="py-8 text-center text-slate-400">{texto}</p>;
}

export function Cartao({ titulo, children }: { titulo?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-700 bg-slate-800/60 p-4">
      {titulo && <h2 className="mb-3 text-lg font-semibold">{titulo}</h2>}
      {children}
    </section>
  );
}

export function CorJogador({ cor, tamanho = "w-4 h-4" }: { cor: CorId | null; tamanho?: string }) {
  if (cor === null) {
    return (
      <span
        title="sem cor"
        className={`inline-block rounded-full border border-dashed border-slate-500 ${tamanho}`}
      />
    );
  }
  return (
    <span
      title={CORES[cor].nome}
      className={`inline-block rounded-full border border-slate-400 ${tamanho}`}
      style={{ backgroundColor: TONS[cor].fundo }}
    />
  );
}
