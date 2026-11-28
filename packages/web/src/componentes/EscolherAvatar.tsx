// Troca da foto do avatar (tela Conta e administração de usuários). A foto é recortada no centro
// e reduzida a LADO_AVATAR px aqui mesmo, antes de enviar. A CSP do site só aceita imagens da
// própria origem ou data: (sem blob:), por isso o arquivo é lido como data URL.
import { LADO_AVATAR, TAMANHO_MAXIMO_AVATAR, type VersaoAvatar } from "@warii/shared";
import { type ChangeEvent, useRef, useState } from "react";
import { ErroDaApi, mensagemDoErro } from "../api/cliente";
import { Avatar } from "./Avatar";
import { Aviso } from "./basicos";

function lerComoDataUrl(arquivo: File): Promise<string> {
  return new Promise((resolver, rejeitar) => {
    const leitor = new FileReader();
    leitor.addEventListener("load", () =>
      typeof leitor.result === "string" ? resolver(leitor.result) : rejeitar(new Error()),
    );
    leitor.addEventListener("error", () => rejeitar(new Error()));
    leitor.readAsDataURL(arquivo);
  });
}

function carregarImagem(src: string): Promise<HTMLImageElement> {
  return new Promise((resolver, rejeitar) => {
    const imagem = new Image();
    imagem.addEventListener("load", () => resolver(imagem));
    imagem.addEventListener("error", () => rejeitar(new Error()));
    imagem.src = src;
  });
}

// Tamanho aproximado dos bytes de uma data URL em base64.
const bytesDe = (dataUrl: string) =>
  Math.floor(((dataUrl.length - dataUrl.indexOf(",") - 1) * 3) / 4);

export async function reduzirImagem(arquivo: File): Promise<string> {
  const imagem = await carregarImagem(await lerComoDataUrl(arquivo));
  const lado = Math.min(imagem.naturalWidth, imagem.naturalHeight);
  if (lado === 0) throw new Error("imagem vazia");
  const tela = document.createElement("canvas");
  tela.width = LADO_AVATAR;
  tela.height = LADO_AVATAR;
  const contexto = tela.getContext("2d");
  if (!contexto) throw new Error("sem canvas");
  contexto.imageSmoothingQuality = "high";
  contexto.drawImage(
    imagem,
    (imagem.naturalWidth - lado) / 2,
    (imagem.naturalHeight - lado) / 2,
    lado,
    lado,
    0,
    0,
    LADO_AVATAR,
    LADO_AVATAR,
  );
  for (const qualidade of [0.85, 0.7, 0.5]) {
    let url = tela.toDataURL("image/webp", qualidade);
    // Navegador sem WebP devolve PNG: usa JPEG.
    if (!url.startsWith("data:image/webp")) url = tela.toDataURL("image/jpeg", qualidade);
    if (bytesDe(url) <= TAMANHO_MAXIMO_AVATAR) return url;
  }
  throw new Error("imagem grande demais");
}

export function EscolherAvatar({
  usuarioId,
  avatar,
  enviar,
  remover,
}: {
  usuarioId: string;
  avatar: VersaoAvatar;
  enviar: (imagem: string) => Promise<unknown>;
  remover: () => Promise<unknown>;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const executar = (tarefa: () => Promise<unknown>) => {
    setErro(null);
    setOcupado(true);
    tarefa()
      .catch((falha: unknown) => setErro(mensagemDoErro(falha)))
      .finally(() => setOcupado(false));
  };

  const aoEscolher = (e: ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
    if (!arquivo.type.startsWith("image/")) {
      setErro("escolha um arquivo de imagem");
      return;
    }
    executar(async () => {
      let imagem: string;
      try {
        imagem = await reduzirImagem(arquivo);
      } catch {
        throw new ErroDaApi(0, "IMAGEM_INVALIDA", "não foi possível usar essa imagem");
      }
      await enviar(imagem);
    });
  };

  return (
    <div className="space-y-espaco-3">
      <div className="flex flex-wrap items-center gap-espaco-5">
        <Avatar usuarioId={usuarioId} avatar={avatar} tamanho={72} />
        <div className="flex flex-wrap gap-espaco-2">
          <button
            type="button"
            className="botao"
            disabled={ocupado}
            onClick={() => entrada.current?.click()}
          >
            {avatar === null ? "Escolher foto" : "Trocar foto"}
          </button>
          {avatar !== null && (
            <button
              type="button"
              className="botao"
              disabled={ocupado}
              onClick={() => executar(remover)}
            >
              Remover foto
            </button>
          )}
        </div>
        <input
          ref={entrada}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={aoEscolher}
        />
      </div>
      <p className="dica">
        A foto é recortada no centro e reduzida. Sem foto, aparece um desenho de guerra.
      </p>
      {erro && <Aviso>{erro}</Aviso>}
    </div>
  );
}
