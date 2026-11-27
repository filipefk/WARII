// Log detalhado da partida (gerado pelo servidor repetindo o log gravado): mostrado numa janela e
// baixável como .txt, para analisar decisões do jogo (inclusive por uma IA).
import type { LogDetalhadoDto } from "@warii/shared";
import { useCallback, useEffect, useState } from "react";
import { apiPartidas } from "../../api/partidas";
import { Aviso, Botao, Carregando } from "../basicos";
import { Modal } from "../Modal";

function baixar({ nomeArquivo, texto }: LogDetalhadoDto) {
  const url = URL.createObjectURL(new Blob([texto], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function LogDetalhado({ partidaId, onFechar }: { partidaId: string; onFechar: () => void }) {
  const [log, setLog] = useState<LogDetalhadoDto | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const buscar = useCallback(() => {
    apiPartidas
      .logDetalhado(partidaId)
      .then((l) => {
        setLog(l);
        setErro(null);
      })
      .catch((e: unknown) =>
        setErro(e instanceof Error ? e.message : "não foi possível gerar o log"),
      )
      .finally(() => setCarregando(false));
  }, [partidaId]);

  useEffect(buscar, [buscar]);

  const atualizar = () => {
    setCarregando(true);
    buscar();
  };

  return (
    <Modal
      titulo="Log detalhado"
      onFechar={onFechar}
      cabecalho={
        <div className="flex flex-wrap gap-espaco-2">
          <Botao disabled={!log} onClick={() => log && baixar(log)}>
            Baixar .txt
          </Botao>
          <Botao disabled={carregando} onClick={atualizar}>
            Atualizar
          </Botao>
        </div>
      }
    >
      {erro && <Aviso>{erro}</Aviso>}
      {carregando && !log ? (
        <Carregando texto="Gerando o log…" />
      ) : (
        log && (
          <pre className="text-tabela leading-snug whitespace-pre-wrap break-words text-text">
            {log.texto}
          </pre>
        )
      )}
    </Modal>
  );
}
