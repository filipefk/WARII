import { Link } from "react-router";

export function NaoEncontrada() {
  return (
    <div className="py-12 text-center">
      <h1 className="text-titulo">Página não encontrada</h1>
      <Link to="/" className="link mt-espaco-7 inline-block">
        Voltar ao início
      </Link>
    </div>
  );
}
