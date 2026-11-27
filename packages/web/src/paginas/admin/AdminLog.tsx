// Log simples por jogador: quando entrou, quando criou partidas e quando jogou (nome da partida e
// adversários). O jogador escolhido fica na URL (?usuario=id), para o botão "Ver log" da aba
// Usuários abrir direto nele.
import type { LogUsuarioDto, TipoLogUsuario, UsuarioAdminDto } from "@warii/shared";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { apiAdmin } from "../../api/admin";
import { mensagemDoErro } from "../../api/cliente";
import { Aviso, Carregando, Cartao } from "../../componentes/basicos";
import { Abas } from "../../componentes/Modal";
import { formatoData } from "./Admin";

type Filtro = TipoLogUsuario | "todos";

const ORDEM: TipoLogUsuario[] = ["login", "partida_criada", "partida_iniciada"];

const NOMES: Record<TipoLogUsuario, string> = {
  login: "Entradas",
  partida_criada: "Partidas criadas",
  partida_iniciada: "Partidas jogadas",
};

const ROTULO: Record<TipoLogUsuario, string> = {
  login: "entrou",
  partida_criada: "criou partida",
  partida_iniciada: "jogou",
};

function descrever(linha: LogUsuarioDto): string {
  if (linha.tipo === "login") return linha.ip ? `IP ${linha.ip}` : "";
  const nome = linha.partida?.nome ?? "";
  const apagada = linha.partida?.id === null ? " (apagada)" : "";
  if (linha.tipo === "partida_criada") return `${nome}${apagada}`;
  const contra = linha.adversarios.map((a) => (a.robo ? `${a.nome} (robô)` : a.nome)).join(", ");
  return `${nome}${apagada} · contra ${contra || "ninguém"}`;
}

function LinhaLog({ linha }: { linha: LogUsuarioDto }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-espaco-5 gap-y-espaco-1 rounded-raio-md border border-border bg-panel-2 px-espaco-4 py-espaco-2">
      <span className="dica w-32 shrink-0 tabular-nums">
        {formatoData.format(new Date(linha.criadoEm))}
      </span>
      <span className="tag">{ROTULO[linha.tipo]}</span>
      <span className={linha.tipo === "login" ? "text-muted" : ""}>{descrever(linha)}</span>
    </li>
  );
}

export function AdminLog() {
  const [parametros, setParametros] = useSearchParams();
  const escolhido = parametros.get("usuario") ?? "";
  const [usuarios, setUsuarios] = useState<UsuarioAdminDto[] | null>(null);
  const [log, setLog] = useState<{ usuarioId: string; linhas: LogUsuarioDto[] } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todos");

  useEffect(() => {
    apiAdmin
      .listarUsuarios()
      .then(setUsuarios)
      .catch((falha: unknown) => setErro(mensagemDoErro(falha)));
  }, []);

  useEffect(() => {
    let vale = true;
    if (escolhido) {
      apiAdmin
        .logDoUsuario(escolhido)
        .then((linhas) => vale && setLog({ usuarioId: escolhido, linhas }))
        .catch((falha: unknown) => vale && setErro(mensagemDoErro(falha)));
    }
    return () => {
      vale = false;
    };
  }, [escolhido]);

  const linhas = log?.usuarioId === escolhido ? log.linhas : null;
  const contar = (t: TipoLogUsuario) => linhas?.filter((l) => l.tipo === t).length ?? 0;
  const abas: { id: Filtro; rotulo: string }[] = [
    { id: "todos", rotulo: `Todos (${linhas?.length ?? 0})` },
    ...ORDEM.map((t) => ({ id: t, rotulo: `${NOMES[t]} (${contar(t)})` })),
  ];
  const visiveis = linhas?.filter((l) => filtro === "todos" || l.tipo === filtro) ?? [];

  return (
    <div className="space-y-espaco-8">
      {erro && <Aviso>{erro}</Aviso>}
      {!usuarios && !erro && <Carregando />}
      {usuarios && (
        <Cartao titulo="Log por jogador">
          <label className="mb-espaco-5 block max-w-sm">
            <span className="mb-espaco-1 block">Jogador</span>
            <select
              className="campo w-full"
              value={escolhido}
              onChange={(e) => {
                setFiltro("todos");
                setErro(null);
                setParametros(e.target.value ? { usuario: e.target.value } : {});
              }}
            >
              <option value="">Escolha um jogador…</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome} ({u.email})
                </option>
              ))}
            </select>
          </label>
          {escolhido && !linhas && !erro && <Carregando />}
          {linhas && (
            <>
              <div className="mb-espaco-5">
                <Abas abas={abas} ativa={filtro} onEscolher={setFiltro} />
              </div>
              {visiveis.length === 0 ? (
                <p className="text-muted">Nada registrado aqui.</p>
              ) : (
                <ul className="space-y-espaco-2">
                  {visiveis.map((l) => (
                    <LinhaLog key={l.id} linha={l} />
                  ))}
                </ul>
              )}
              <p className="dica mt-espaco-5">Mostra os 300 registros mais recentes.</p>
            </>
          )}
        </Cartao>
      )}
    </div>
  );
}
