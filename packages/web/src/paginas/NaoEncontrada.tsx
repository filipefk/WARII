import { Link } from "react-router";

export function NaoEncontrada() {
  return (
    <div className="py-12 text-center">
      <h1 className="text-2xl font-bold">Página não encontrada</h1>
      <Link to="/" className="mt-4 inline-block text-amber-400 hover:underline">
        Voltar ao início
      </Link>
    </div>
  );
}
