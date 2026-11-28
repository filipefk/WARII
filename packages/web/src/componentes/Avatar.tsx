// Avatar do usuário: foto pequena e redonda ao lado do nome. Sem foto (`avatar` nulo), um desenho
// com motivo de guerra (capacete, avião, tanque, fuzil, granada, navio, paraquedas, estrela),
// sempre o mesmo para o mesmo usuário (sai de um hash do id).
import { urlDoAvatar, type VersaoAvatar } from "@warii/shared";
import { type ReactNode, useState } from "react";

// Pares fundo/desenho dos tokens (nomes por extenso: o Tailwind só emite as variáveis citadas).
const TONS: [string, string][] = [
  ["var(--color-board-mid)", "var(--color-board-rings)"],
  ["var(--color-objetivo-azul)", "var(--color-objetivo-legenda)"],
  ["var(--color-carta-vermelho-fundo)", "var(--color-carta-papel)"],
  ["var(--color-panel-2)", "var(--color-accent)"],
  ["var(--color-carta-moldura)", "var(--color-objetivo-numero)"],
  ["var(--color-board-edge)", "var(--color-base-frame)"],
];

// Desenhos num quadro de 32×32 (o círculo de fundo é desenhado à parte). `fundo` é a cor do
// círculo, usada para "vazar" detalhes.
const MOTIVOS: ((fundo: string) => ReactNode)[] = [
  // Capacete
  (fundo) => (
    <>
      <path d="M7 19.5a9 9 0 0 1 18 0z" />
      <rect x="4.5" y="19" width="23" height="3" rx="1.5" />
      <path d="M11 22.5q5 5 10 0" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10 15h12" stroke={fundo} strokeWidth="1" />
    </>
  ),
  // Avião visto de cima
  () => (
    <path d="M16 4.5l1.6 7.5 10 4.2v2.2l-10-2.4-.5 7.5 3.4 2.4v1.6L16 26.4l-4.5 1.1v-1.6l3.4-2.4-.5-7.5-10 2.4v-2.2l10-4.2z" />
  ),
  // Tanque
  (fundo) => (
    <>
      <rect x="12" y="10.5" width="8" height="4.5" rx="1.2" />
      <rect x="19" y="11.8" width="9.5" height="1.8" rx=".6" />
      <path d="M8 18l2.2-3.5h11.6L24 18z" />
      <rect x="5" y="18" width="22" height="7" rx="3.5" />
      {[9, 13.2, 17.4, 21.6].map((x) => (
        <circle key={x} cx={x + 1} cy="21.5" r="1.6" fill={fundo} />
      ))}
    </>
  ),
  // Fuzil
  () => <path d="M3.5 17.5l6-1.6H23V15h5.5v1.4H23v1.9h-8.6l-1.2 4.2h-2.6l.6-4.2-2.8 3.2H3.5z" />,
  // Granada
  (fundo) => (
    <>
      <ellipse cx="16" cy="20" rx="6.5" ry="7.5" />
      <rect x="13" y="9" width="6" height="4" rx="1" />
      <path d="M19 10.5h3.5l1.5 6" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="11.5" cy="10" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M11 17.5h10M11 22.5h10M16 13v14" stroke={fundo} strokeWidth=".9" />
    </>
  ),
  // Navio
  () => (
    <>
      <path d="M3 19.5h26l-4 6H7z" />
      <rect x="10" y="14.5" width="10" height="5" />
      <rect x="14" y="9.5" width="3" height="5" />
      <rect x="20" y="16" width="7" height="1.4" />
    </>
  ),
  // Paraquedas
  () => (
    <>
      <path d="M5 15a11 9.5 0 0 1 22 0z" />
      <path
        d="M5.5 15l9.5 9M26.5 15L17 24M12 15l3.3 9M20 15l-3.3 9"
        stroke="currentColor"
        strokeWidth=".9"
      />
      <circle cx="16" cy="24.2" r="1.6" />
      <rect x="15" y="25.5" width="2" height="3.5" rx="1" />
    </>
  ),
  // Estrela militar
  () => (
    <>
      <circle cx="16" cy="16" r="10.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M16 7.5l2.5 5.9 6.3.5-4.8 4.2 1.5 6.2L16 21l-5.5 3.3 1.5-6.2-4.8-4.2 6.3-.5z" />
    </>
  ),
];

function hash(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function AvatarPadrao({ usuarioId, tamanho }: { usuarioId: string; tamanho: number }) {
  const h = hash(usuarioId);
  const motivo = MOTIVOS[h % MOTIVOS.length] ?? MOTIVOS[0];
  const [fundo, desenho] = TONS[Math.floor(h / MOTIVOS.length) % TONS.length] ?? TONS[0] ?? [];
  return (
    <svg
      viewBox="0 0 32 32"
      width={tamanho}
      height={tamanho}
      aria-hidden="true"
      className="block shrink-0 rounded-raio-circulo"
      style={{ color: desenho }}
      fill="currentColor"
    >
      <circle cx="16" cy="16" r="16" fill={fundo} />
      {motivo?.(fundo ?? "")}
    </svg>
  );
}

export function Avatar({
  usuarioId,
  avatar,
  nome,
  tamanho = 22,
}: {
  usuarioId: string;
  avatar: VersaoAvatar;
  // Para a dica ao passar o mouse.
  nome?: string;
  tamanho?: number;
}) {
  // Imagem que falhou ao carregar (apagada entre a lista e o pedido): cai no padrão.
  const [falhou, setFalhou] = useState<string | null>(null);
  const url = avatar === null ? null : urlDoAvatar(usuarioId, avatar);
  return (
    <span
      title={nome}
      className="inline-block shrink-0 overflow-hidden rounded-raio-circulo border border-border"
      style={{ width: tamanho, height: tamanho }}
    >
      {url && falhou !== url ? (
        <img
          src={url}
          alt=""
          width={tamanho}
          height={tamanho}
          loading="lazy"
          className="block h-full w-full object-cover"
          onError={() => setFalhou(url)}
        />
      ) : (
        <AvatarPadrao usuarioId={usuarioId} tamanho={tamanho - 2} />
      )}
    </span>
  );
}

// Nome com o avatar à esquerda.
export function NomeComAvatar({
  usuarioId,
  avatar,
  nome,
  tamanho,
  className = "",
  children,
}: {
  usuarioId: string;
  avatar: VersaoAvatar;
  nome: string;
  tamanho?: number;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <span className={`inline-flex items-center gap-espaco-2 ${className}`}>
      <Avatar usuarioId={usuarioId} avatar={avatar} tamanho={tamanho} />
      <span>{nome}</span>
      {children}
    </span>
  );
}
