// Moldura das telas de administração: título e abas (Usuários, Partidas), mais peças comuns.
import { type ReactNode, useState } from "react";
import { NavLink, Outlet } from "react-router";
import { mensagemDoErro } from "../../api/cliente";
import { Aviso, Botao, TituloDaTela } from "../../componentes/basicos";
import { Modal } from "../../componentes/Modal";

const classeAba = ({ isActive }: { isActive: boolean }) => `botao ${isActive ? "ativo" : ""}`;

export function Admin() {
  return (
    <div className="space-y-espaco-8">
      <div className="flex flex-wrap items-end justify-between gap-espaco-5">
        <TituloDaTela titulo="Administração" apoio="Contas dos jogadores e todas as partidas." />
        <nav className="flex gap-espaco-2" aria-label="Administração">
          <NavLink to="/admin/usuarios" className={classeAba}>
            Usuários
          </NavLink>
          <NavLink to="/admin/partidas" className={classeAba}>
            Partidas
          </NavLink>
        </nav>
      </div>
      <Outlet />
    </div>
  );
}

// Janela de confirmação de uma ação que não tem volta. A ação em destaque vem primeiro.
export function Confirmar({
  titulo,
  rotulo,
  children,
  acao,
  onFechar,
}: {
  titulo: string;
  rotulo: string;
  children: ReactNode;
  acao: () => Promise<unknown>;
  onFechar: () => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const confirmar = () => {
    setErro(null);
    setEnviando(true);
    acao()
      .then(onFechar)
      .catch((falha: unknown) => {
        setErro(mensagemDoErro(falha));
        setEnviando(false);
      });
  };
  return (
    <Modal titulo={titulo} estreito onFechar={onFechar}>
      <div className="space-y-espaco-7 pt-espaco-5">
        <div>{children}</div>
        {erro && <Aviso>{erro}</Aviso>}
        <div className="flex flex-wrap gap-espaco-2">
          <Botao onClick={confirmar} ocupado={enviando}>
            {rotulo}
          </Botao>
          <Botao onClick={onFechar}>Voltar</Botao>
        </div>
      </div>
    </Modal>
  );
}

export const formatoData = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});
