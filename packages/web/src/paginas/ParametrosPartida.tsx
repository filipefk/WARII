// Parâmetros da partida (WARII.md §13.4). O anfitrião edita um rascunho local e salva só o que
// mudou; os demais veem em modo leitura, com destaque para o que difere do padrão.
import {
  CONTINENTES,
  IDS_CONTINENTES,
  PARAMETROS_PADRAO,
  type BonusContinente,
  type ContinenteId,
  type Parametros,
} from "@warii/engine";
import {
  esquemaParametrosParciais,
  type ParametrosParciaisEntrada,
  type PartidaLobbyDto,
} from "@warii/shared";
import { useState } from "react";
import { mensagemDoErro } from "../api/cliente";
import { apiPartidas } from "../api/partidas";
import { Aviso, Botao, Cartao } from "../componentes/basicos";
import { usePartidas } from "../stores/partidas";
import { CAMPOS_PARAMETROS, ehChaveParametro, ORDEM_PARAMETROS } from "../ui/parametros";

type Chave = keyof Parametros;

// Igualdade profunda que ignora a ordem das chaves (o jsonb do Postgres devolve os objetos com
// as chaves reordenadas, então JSON.stringify daria "diferente" para valores iguais).
function igual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const chavesA = Object.keys(a);
  const chavesB = Object.keys(b);
  if (chavesA.length !== chavesB.length) return false;
  return chavesA.every(
    (k) => Object.hasOwn(b, k) && igual(Reflect.get(a, k), Reflect.get(b, k)),
  );
}

// Campo numérico vazio vira NaN, que a validação recusa com mensagem.
const paraNumero = (texto: string) => (texto.trim() === "" ? Number.NaN : Number(texto));

const exibirNumero = (valor: number) => (Number.isNaN(valor) ? "" : String(valor));

const ehFaces = (valor: unknown): valor is readonly number[] => Array.isArray(valor);

function chavesAlteradas(rascunho: Parametros, servidor: Parametros): Chave[] {
  return ORDEM_PARAMETROS.filter((k) => !igual(rascunho[k], servidor[k]));
}

function SeloPadrao({ diferente }: { diferente: boolean }) {
  if (!diferente) return null;
  return (
    <span className="ml-2 rounded bg-sky-500/20 px-1.5 text-xs text-sky-300" title="diferente do padrão">
      alterado
    </span>
  );
}

const classeNumero =
  "w-16 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-right text-sm disabled:opacity-60";

function CampoFaces({
  faces,
  editavel,
  aoMudar,
}: {
  faces: readonly number[];
  editavel: boolean;
  aoMudar: (faces: number[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {faces.map((valor, i) => (
        <input
          // As faces são posições fixas (sempre 6): o índice é a identidade.
          key={i}
          type="number"
          min={0}
          aria-label={`face ${i + 1}`}
          disabled={!editavel}
          value={exibirNumero(valor)}
          onChange={(e) => aoMudar(faces.map((f, j) => (j === i ? paraNumero(e.target.value) : f)))}
          className={classeNumero.replace("w-16", "w-12")}
        />
      ))}
    </div>
  );
}

function TabelaBonus({
  bonus,
  editavel,
  aoMudar,
}: {
  bonus: Parametros["bonusContinentes"];
  editavel: boolean;
  aoMudar: (bonus: Record<ContinenteId, BonusContinente>) => void;
}) {
  const alterar = (c: ContinenteId, campo: keyof BonusContinente, valor: number) =>
    aoMudar({ ...bonus, [c]: { ...bonus[c], [campo]: valor } });
  return (
    <table className="text-sm">
      <thead>
        <tr className="text-left text-slate-400">
          <th className="pr-4 font-normal">Continente</th>
          <th className="pr-2 font-normal">Maioria</th>
          <th className="font-normal">Totalidade</th>
        </tr>
      </thead>
      <tbody>
        {IDS_CONTINENTES.map((c) => (
          <tr key={c}>
            <td className="py-0.5 pr-4">{CONTINENTES[c].nome}</td>
            {(["maioria", "totalidade"] as const).map((campo) => (
              <td key={campo} className="py-0.5 pr-2">
                <input
                  type="number"
                  min={0}
                  aria-label={`${CONTINENTES[c].nome}: ${campo}`}
                  disabled={!editavel}
                  value={exibirNumero(bonus[c][campo])}
                  onChange={(e) => alterar(c, campo, paraNumero(e.target.value))}
                  className={classeNumero}
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function LinhaParametro({
  chave,
  valores,
  editavel,
  alterar,
}: {
  chave: Chave;
  valores: Parametros;
  editavel: boolean;
  alterar: <K extends Chave>(chave: K, valor: Parametros[K]) => void;
}) {
  const campo = CAMPOS_PARAMETROS[chave];
  const diferente = !igual(valores[chave], PARAMETROS_PADRAO[chave]);
  const titulo = (
    <span className="font-medium">
      {campo.rotulo}
      <SeloPadrao diferente={diferente} />
    </span>
  );
  const descricao = <span className="block text-xs text-slate-400">{campo.descricao}</span>;

  const valor = valores[chave];

  switch (campo.tipo) {
    case "booleano": {
      if (typeof valor !== "boolean") return null;
      const bloqueio = "desabilitado" in campo ? campo.desabilitado : undefined;
      return (
        <label className="flex items-start gap-3 py-2">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-amber-500"
            checked={valor}
            disabled={!editavel || bloqueio !== undefined}
            onChange={(e) => alterar(chave, e.target.checked as Parametros[typeof chave])}
          />
          <span>
            {titulo}
            {descricao}
            {bloqueio && <span className="block text-xs text-amber-300">{bloqueio}</span>}
          </span>
        </label>
      );
    }
    case "inteiro": {
      if (typeof valor !== "number") return null;
      return (
        <div className="flex items-start justify-between gap-3 py-2">
          <span>
            {titulo}
            {descricao}
          </span>
          <input
            type="number"
            min={campo.minimo}
            aria-label={campo.rotulo}
            disabled={!editavel}
            value={exibirNumero(valor)}
            onChange={(e) =>
              alterar(chave, paraNumero(e.target.value) as Parametros[typeof chave])
            }
            className={classeNumero}
          />
        </div>
      );
    }
    case "faces":
      if (!ehFaces(valor)) return null;
      return (
        <div className="space-y-1 py-2">
          {titulo}
          {descricao}
          <CampoFaces
            faces={valor}
            editavel={editavel}
            aoMudar={(faces) => alterar(chave, faces as Parametros[typeof chave])}
          />
        </div>
      );
    case "bonus":
      return (
        <div className="space-y-1 py-2">
          {titulo}
          {descricao}
          <TabelaBonus
            bonus={valores.bonusContinentes}
            editavel={editavel}
            aoMudar={(bonus) => alterar("bonusContinentes", bonus)}
          />
        </div>
      );
    default:
      return null;
  }
}

export function ParametrosPartida({
  lobby,
  editavel,
}: {
  lobby: PartidaLobbyDto;
  editavel: boolean;
}) {
  const gravarLobby = usePartidas((s) => s.gravarLobby);
  const servidor = lobby.parametros;
  // Rascunho do anfitrião e os parâmetros do servidor no momento em que ele começou.
  const [rascunho, setRascunho] = useState<{ valores: Parametros; base: Parametros } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const valores = rascunho?.valores ?? servidor;
  const alteradas = rascunho ? chavesAlteradas(rascunho.valores, servidor) : [];
  const mudouNoServidor = rascunho !== null && !igual(rascunho.base, servidor);

  const alterar = <K extends Chave>(chave: K, valor: Parametros[K]) => {
    setRascunho((r) => ({
      valores: { ...(r?.valores ?? servidor), [chave]: valor },
      base: r?.base ?? servidor,
    }));
  };

  const restaurarPadrao = () =>
    setRascunho((r) => ({ valores: structuredClone(PARAMETROS_PADRAO), base: r?.base ?? servidor }));

  const descartar = () => {
    setRascunho(null);
    setErro(null);
  };

  const salvar = () => {
    if (!rascunho || alteradas.length === 0) return;
    const parcial: Record<string, unknown> = {};
    for (const k of alteradas) parcial[k] = rascunho.valores[k];
    const entrada = esquemaParametrosParciais.safeParse(parcial);
    if (!entrada.success) {
      const problema = entrada.error.issues[0];
      const chave = problema?.path[0];
      const nome =
        typeof chave === "string" && ehChaveParametro(chave)
          ? CAMPOS_PARAMETROS[chave].rotulo
          : "parâmetros";
      setErro(`${nome}: ${problema?.message ?? "valor inválido"}`);
      return;
    }
    const alteracoes: ParametrosParciaisEntrada = entrada.data;
    setErro(null);
    setSalvando(true);
    apiPartidas
      .configurar(lobby.id, alteracoes)
      .then((atualizado) => {
        gravarLobby(atualizado);
        setRascunho(null);
      })
      .catch((falha: unknown) => setErro(mensagemDoErro(falha)))
      .finally(() => setSalvando(false));
  };

  return (
    <Cartao titulo="Regras da partida">
      {!editavel && (
        <p className="mb-2 text-sm text-slate-400">Só o anfitrião altera as regras.</p>
      )}
      <div className="divide-y divide-slate-700/60">
        {ORDEM_PARAMETROS.map((chave) => (
          <LinhaParametro
            key={chave}
            chave={chave}
            valores={valores}
            editavel={editavel && !salvando}
            alterar={alterar}
          />
        ))}
      </div>
      {editavel && (
        <div className="mt-4 space-y-3">
          {mudouNoServidor && (
            <Aviso tipo="info">
              As regras foram alteradas em outra janela enquanto você editava. Salvar aplica as
              suas mudanças por cima; descartar mostra as atuais.
            </Aviso>
          )}
          {erro && <Aviso>{erro}</Aviso>}
          <div className="flex flex-wrap gap-2">
            <Botao ocupado={salvando} disabled={alteradas.length === 0} onClick={salvar}>
              Salvar{alteradas.length > 0 ? ` (${alteradas.length})` : ""}
            </Botao>
            <Botao variante="secundario" disabled={!rascunho || salvando} onClick={descartar}>
              Descartar
            </Botao>
            <Botao
              variante="secundario"
              disabled={salvando || igual(valores, PARAMETROS_PADRAO)}
              onClick={restaurarPadrao}
            >
              Restaurar padrão
            </Botao>
          </div>
        </div>
      )}
    </Cartao>
  );
}
