// Cadastro de usuários: criar, editar (nome, e-mail, administrador), apagar, gerar o link para o
// próprio usuário definir a senha e definir a senha direto.
import {
  CriarUsuarioEntrada,
  DefinirSenhaDoUsuarioEntrada,
  EditarUsuarioEntrada,
  type LinkSenhaDto,
  SENHA_MIN,
  type UsuarioAdminDto,
} from "@warii/shared";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { apiAdmin } from "../../api/admin";
import { mensagemDoErro } from "../../api/cliente";
import { Avatar } from "../../componentes/Avatar";
import { Aviso, Botao, Campo, Carregando, Cartao } from "../../componentes/basicos";
import { EscolherAvatar } from "../../componentes/EscolherAvatar";
import { Modal } from "../../componentes/Modal";
import { useSessao } from "../../stores/sessao";
import { Confirmar } from "../../componentes/JanelaPopup";
import { formatoData } from "./Admin";

type Janela =
  | { tipo: "editar"; usuario: UsuarioAdminDto }
  | { tipo: "senha"; usuario: UsuarioAdminDto }
  | { tipo: "avatar"; usuario: UsuarioAdminDto }
  | { tipo: "apagar"; usuario: UsuarioAdminDto }
  | { tipo: "link"; usuario: UsuarioAdminDto; link: LinkSenhaDto };

function CaixaAdmin({
  marcado,
  onMudar,
  desabilitado,
}: {
  marcado: boolean;
  onMudar: (valor: boolean) => void;
  desabilitado?: string;
}) {
  return (
    <label className="flex items-start gap-espaco-5">
      <input
        type="checkbox"
        className="mt-espaco-1 h-4 w-4"
        checked={marcado}
        disabled={desabilitado !== undefined}
        onChange={(e) => onMudar(e.target.checked)}
      />
      <span>
        Administrador
        <span className="dica block">
          {desabilitado ?? "Vê estas telas: cadastra usuários e encerra ou apaga partidas."}
        </span>
      </span>
    </label>
  );
}

function NovoUsuario({
  aoCriar,
}: {
  aoCriar: (usuario: UsuarioAdminDto, link: LinkSenhaDto) => void;
}) {
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [admin, setAdmin] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const aoEnviar = (e: FormEvent) => {
    e.preventDefault();
    const entrada = CriarUsuarioEntrada.safeParse({ email, nome, admin });
    if (!entrada.success) {
      setErro(entrada.error.issues[0]?.message ?? "dados inválidos");
      return;
    }
    setErro(null);
    setEnviando(true);
    apiAdmin
      .criarUsuario(entrada.data)
      .then(async (usuario) => {
        const link = await apiAdmin.gerarLinkSenha(usuario.id);
        setEmail("");
        setNome("");
        setAdmin(false);
        aoCriar(usuario, link);
      })
      .catch((falha: unknown) => setErro(mensagemDoErro(falha)))
      .finally(() => setEnviando(false));
  };

  return (
    <Cartao titulo="Novo usuário">
      <form onSubmit={aoEnviar} className="space-y-espaco-7" noValidate>
        <div className="grid gap-espaco-5 sm:grid-cols-2">
          <Campo
            rotulo="E-mail"
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Campo
            rotulo="Nome no jogo"
            autoComplete="off"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
        </div>
        <CaixaAdmin marcado={admin} onMudar={setAdmin} />
        {erro && <Aviso>{erro}</Aviso>}
        <div className="flex flex-wrap items-center gap-espaco-5">
          <Botao type="submit" ocupado={enviando}>
            Criar usuário
          </Botao>
          <span className="dica">Ao criar, sai o link de ativação para enviar ao jogador.</span>
        </div>
      </form>
    </Cartao>
  );
}

function EditarUsuario({
  usuario,
  proprio,
  aoSalvar,
  onFechar,
}: {
  usuario: UsuarioAdminDto;
  proprio: boolean;
  aoSalvar: (usuario: UsuarioAdminDto) => void;
  onFechar: () => void;
}) {
  const [email, setEmail] = useState(usuario.email);
  const [nome, setNome] = useState(usuario.nome);
  const [admin, setAdmin] = useState(usuario.admin);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const aoEnviar = (e: FormEvent) => {
    e.preventDefault();
    const entrada = EditarUsuarioEntrada.safeParse({ email, nome, admin });
    if (!entrada.success) {
      setErro(entrada.error.issues[0]?.message ?? "dados inválidos");
      return;
    }
    setErro(null);
    setEnviando(true);
    apiAdmin
      .editarUsuario(usuario.id, entrada.data)
      .then((salvo) => {
        aoSalvar(salvo);
        onFechar();
      })
      .catch((falha: unknown) => {
        setErro(mensagemDoErro(falha));
        setEnviando(false);
      });
  };

  return (
    <Modal titulo={`Editar ${usuario.nome}`} estreito onFechar={onFechar}>
      <form onSubmit={aoEnviar} className="space-y-espaco-7 pt-espaco-5" noValidate>
        <Campo
          rotulo="E-mail"
          type="email"
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Campo
          rotulo="Nome no jogo"
          autoComplete="off"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
        <CaixaAdmin
          marcado={admin}
          onMudar={setAdmin}
          desabilitado={proprio ? "Você não pode tirar o seu próprio acesso." : undefined}
        />
        {erro && <Aviso>{erro}</Aviso>}
        <div className="flex flex-wrap gap-espaco-2">
          <Botao type="submit" ocupado={enviando}>
            Salvar
          </Botao>
          <Botao onClick={onFechar}>Voltar</Botao>
        </div>
      </form>
    </Modal>
  );
}

function FotoDoUsuario({
  usuario,
  aoSalvar,
  onFechar,
}: {
  usuario: UsuarioAdminDto;
  aoSalvar: (usuario: UsuarioAdminDto) => void;
  onFechar: () => void;
}) {
  const [atual, setAtual] = useState(usuario);
  const salvar = (salvo: UsuarioAdminDto) => {
    setAtual(salvo);
    aoSalvar(salvo);
  };
  return (
    <Modal titulo={`Avatar de ${usuario.nome}`} estreito onFechar={onFechar}>
      <div className="space-y-espaco-7 pt-espaco-5">
        <EscolherAvatar
          usuarioId={atual.id}
          avatar={atual.avatar}
          enviar={async (imagem) => salvar(await apiAdmin.definirAvatar(atual.id, imagem))}
          remover={async () => salvar(await apiAdmin.removerAvatar(atual.id))}
        />
        <Botao onClick={onFechar}>Voltar</Botao>
      </div>
    </Modal>
  );
}

function DefinirSenha({
  usuario,
  aoSalvar,
  onFechar,
}: {
  usuario: UsuarioAdminDto;
  aoSalvar: (usuario: UsuarioAdminDto) => void;
  onFechar: () => void;
}) {
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const aoEnviar = (e: FormEvent) => {
    e.preventDefault();
    if (senha !== confirmacao) {
      setErro("as senhas não conferem");
      return;
    }
    const entrada = DefinirSenhaDoUsuarioEntrada.safeParse({ senha });
    if (!entrada.success) {
      setErro(entrada.error.issues[0]?.message ?? "dados inválidos");
      return;
    }
    setErro(null);
    setEnviando(true);
    apiAdmin
      .definirSenha(usuario.id, entrada.data.senha)
      .then((salvo) => {
        aoSalvar(salvo);
        onFechar();
      })
      .catch((falha: unknown) => {
        setErro(mensagemDoErro(falha));
        setEnviando(false);
      });
  };

  return (
    <Modal titulo={`Definir a senha de ${usuario.nome}`} estreito onFechar={onFechar}>
      <form onSubmit={aoEnviar} className="space-y-espaco-7 pt-espaco-5" noValidate>
        <p className="dica">
          As sessões abertas do jogador são encerradas e os links de senha pendentes deixam de
          valer. Passe a senha ao jogador por um canal seguro.
        </p>
        <Campo
          rotulo="Nova senha"
          type="password"
          autoComplete="new-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          dica={`Pelo menos ${SENHA_MIN} caracteres.`}
        />
        <Campo
          rotulo="Confirme a nova senha"
          type="password"
          autoComplete="new-password"
          value={confirmacao}
          onChange={(e) => setConfirmacao(e.target.value)}
        />
        {erro && <Aviso>{erro}</Aviso>}
        <div className="flex flex-wrap gap-espaco-2">
          <Botao type="submit" ocupado={enviando}>
            Definir senha
          </Botao>
          <Botao onClick={onFechar}>Voltar</Botao>
        </div>
      </form>
    </Modal>
  );
}

function LinkDeSenha({
  usuario,
  link,
  onFechar,
}: {
  usuario: UsuarioAdminDto;
  link: LinkSenhaDto;
  onFechar: () => void;
}) {
  const [copiado, setCopiado] = useState<boolean | null>(null);
  const copiar = () => {
    navigator.clipboard.writeText(link.link).then(
      () => setCopiado(true),
      () => setCopiado(false),
    );
  };
  const ativacao = link.finalidade === "ativacao";
  return (
    <Modal
      titulo={
        ativacao ? `Link de ativação de ${usuario.nome}` : `Link de nova senha de ${usuario.nome}`
      }
      estreito
      onFechar={onFechar}
    >
      <div className="space-y-espaco-7 pt-espaco-5">
        <p className="dica">
          Envie só para {usuario.nome}: o link é de uso único, vale até{" "}
          {formatoData.format(new Date(link.expiraEm))} e invalida os links anteriores.
        </p>
        <input
          className="campo w-full"
          readOnly
          value={link.link}
          onFocus={(e) => e.target.select()}
        />
        {copiado === true && <Aviso tipo="sucesso">Link copiado.</Aviso>}
        {copiado === false && <Aviso>Não deu para copiar; selecione o link e copie à mão.</Aviso>}
        <div className="flex flex-wrap gap-espaco-2">
          <Botao onClick={copiar}>Copiar link</Botao>
          <Botao onClick={onFechar}>Fechar</Botao>
        </div>
      </div>
    </Modal>
  );
}

function LinhaUsuario({
  usuario,
  proprio,
  abrir,
}: {
  usuario: UsuarioAdminDto;
  proprio: boolean;
  abrir: (janela: Janela) => void;
}) {
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const gerarLink = () => {
    setErro(null);
    setGerando(true);
    apiAdmin
      .gerarLinkSenha(usuario.id)
      .then((link) => abrir({ tipo: "link", usuario, link }))
      .catch((falha: unknown) => setErro(mensagemDoErro(falha)))
      .finally(() => setGerando(false));
  };
  return (
    <li className="rounded-raio-md border border-border bg-panel-2 px-espaco-4 py-espaco-3">
      <div className="flex flex-wrap items-center gap-x-espaco-7 gap-y-espaco-1">
        <span className="text-destaque inline-flex items-center gap-espaco-2">
          <Avatar usuarioId={usuario.id} avatar={usuario.avatar} tamanho={28} />
          {usuario.nome}
          {usuario.admin && <span className="tag">admin</span>}
          {proprio && <span className="tag">você</span>}
        </span>
        <span className="text-muted">{usuario.email}</span>
        <span className={usuario.ativa ? "text-good" : "text-muted"}>
          {usuario.ativa ? "Ativa" : "Aguardando ativação"}
        </span>
        <span className="text-muted">
          {usuario.partidas} {usuario.partidas === 1 ? "partida" : "partidas"}
        </span>
        <span className="dica ml-auto tabular-nums">
          desde {formatoData.format(new Date(usuario.criadoEm))}
        </span>
      </div>
      <div className="mt-espaco-3 flex flex-wrap gap-espaco-2">
        <Botao onClick={() => abrir({ tipo: "editar", usuario })}>Editar</Botao>
        <Botao onClick={gerarLink} ocupado={gerando}>
          {usuario.ativa ? "Gerar link de nova senha" : "Gerar link de ativação"}
        </Botao>
        <Botao onClick={() => abrir({ tipo: "senha", usuario })}>Definir senha</Botao>
        <Botao onClick={() => abrir({ tipo: "avatar", usuario })}>Avatar</Botao>
        <Link to={`/admin/log?usuario=${encodeURIComponent(usuario.id)}`} className="botao">
          Ver log
        </Link>
        {!proprio && <Botao onClick={() => abrir({ tipo: "apagar", usuario })}>Apagar</Botao>}
      </div>
      {erro && (
        <div className="mt-espaco-3">
          <Aviso>{erro}</Aviso>
        </div>
      )}
    </li>
  );
}

const ordenar = (usuarios: UsuarioAdminDto[]) =>
  usuarios.toSorted((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

export function AdminUsuarios() {
  const eu = useSessao((s) => s.usuario);
  const carregarSessao = useSessao((s) => s.carregar);
  const [lista, setLista] = useState<UsuarioAdminDto[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [janela, setJanela] = useState<Janela | null>(null);
  const fechar = useCallback(() => setJanela(null), []);

  useEffect(() => {
    let ativo = true;
    apiAdmin
      .listarUsuarios()
      .then((usuarios) => ativo && setLista(usuarios))
      .catch((falha: unknown) => ativo && setErro(mensagemDoErro(falha)));
    return () => {
      ativo = false;
    };
  }, []);

  const trocar = (usuario: UsuarioAdminDto) => {
    setLista((atual) => ordenar((atual ?? []).map((u) => (u.id === usuario.id ? usuario : u))));
    // O próprio nome, e-mail ou avatar aparece no cabeçalho.
    if (usuario.id === eu?.id) void carregarSessao();
  };

  return (
    <div className="space-y-espaco-8">
      <NovoUsuario
        aoCriar={(usuario, link) => {
          setLista((atual) => ordenar([...(atual ?? []), usuario]));
          setJanela({ tipo: "link", usuario, link });
        }}
      />
      {erro && <Aviso>{erro}</Aviso>}
      {!lista && !erro && <Carregando />}
      {lista && (
        <Cartao titulo={`Usuários (${lista.length})`}>
          <ul className="space-y-espaco-2">
            {lista.map((u) => (
              <LinhaUsuario key={u.id} usuario={u} proprio={u.id === eu?.id} abrir={setJanela} />
            ))}
          </ul>
        </Cartao>
      )}

      {janela?.tipo === "editar" && (
        <EditarUsuario
          usuario={janela.usuario}
          proprio={janela.usuario.id === eu?.id}
          aoSalvar={trocar}
          onFechar={fechar}
        />
      )}
      {janela?.tipo === "avatar" && (
        <FotoDoUsuario usuario={janela.usuario} aoSalvar={trocar} onFechar={fechar} />
      )}
      {janela?.tipo === "senha" && (
        <DefinirSenha usuario={janela.usuario} aoSalvar={trocar} onFechar={fechar} />
      )}
      {janela?.tipo === "link" && (
        <LinkDeSenha usuario={janela.usuario} link={janela.link} onFechar={fechar} />
      )}
      {janela?.tipo === "apagar" && (
        <Confirmar
          titulo={`Apagar ${janela.usuario.nome}`}
          rotulo="Apagar conta"
          onFechar={fechar}
          acao={async () => {
            await apiAdmin.apagarUsuario(janela.usuario.id);
            setLista((atual) => (atual ?? []).filter((u) => u.id !== janela.usuario.id));
          }}
        >
          A conta de <b>{janela.usuario.nome}</b> ({janela.usuario.email}) será apagada, sem como
          desfazer. Só dá para apagar quem nunca entrou numa partida.
        </Confirmar>
      )}
    </div>
  );
}
