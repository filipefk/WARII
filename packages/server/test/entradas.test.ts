// Schemas zod das rotas de auth (@warii/shared). Não usa banco.
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  DefinirSenhaEntrada,
  esquemaEmail,
  esquemaNome,
  LoginEntrada,
  TrocarSenhaEntrada,
} from "@warii/shared";

const TOKEN = "A".repeat(43);

function aceita(esquema: { safeParse: (valor: unknown) => { success: boolean } }, valor: unknown) {
  return esquema.safeParse(valor).success;
}

describe("entradas das rotas de auth", () => {
  test("e-mail: tira espaços, recusa inválidos e longos demais", () => {
    assert.equal(esquemaEmail.parse("  amigo@x.com "), "amigo@x.com");
    for (const invalido of ["", "amigo", "amigo@", "@x.com", `${"a".repeat(250)}@x.com`]) {
      assert.equal(aceita(esquemaEmail, invalido), false, invalido);
    }
  });

  test("nome: de 2 a 24 caracteres depois de tirar espaços", () => {
    assert.equal(esquemaNome.parse("  Boca "), "Boca");
    assert.equal(aceita(esquemaNome, " a "), false);
    assert.equal(aceita(esquemaNome, "x".repeat(25)), false);
  });

  test("definir senha: política de 10 a 128 caracteres e token no formato", () => {
    assert.equal(aceita(DefinirSenhaEntrada, { token: TOKEN, senha: "1234567890" }), true);
    assert.equal(aceita(DefinirSenhaEntrada, { token: TOKEN, senha: "123456789" }), false);
    assert.equal(aceita(DefinirSenhaEntrada, { token: TOKEN, senha: "x".repeat(129) }), false);
    assert.equal(aceita(DefinirSenhaEntrada, { token: "curto", senha: "1234567890" }), false);
  });

  test("login não aplica a política de senha, só exige algo e limita o tamanho", () => {
    assert.equal(aceita(LoginEntrada, { email: "a@b.co", senha: "x" }), true);
    assert.equal(aceita(LoginEntrada, { email: "a@b.co", senha: "" }), false);
    assert.equal(aceita(LoginEntrada, { email: "a@b.co", senha: "x".repeat(129) }), false);
    assert.equal(aceita(LoginEntrada, { email: "a@b.co" }), false);
  });

  test("troca de senha aplica a política só à senha nova", () => {
    assert.equal(aceita(TrocarSenhaEntrada, { senhaAtual: "x", novaSenha: "1234567890" }), true);
    assert.equal(aceita(TrocarSenhaEntrada, { senhaAtual: "x", novaSenha: "curta" }), false);
  });
});
