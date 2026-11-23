// Hash de senha (Argon2id em formato PHC). Não usa banco.
import "./ambiente.js";

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { gerarHashSenha, obterHashFicticio, verificarSenha } from "../src/auth/senha.js";

describe("senha", () => {
  test("gera hash no formato PHC com os parâmetros da OWASP", async () => {
    const hash = await gerarHashSenha("uma senha qualquer");
    assert.match(hash, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}$/);
  });

  test("a mesma senha gera hashes diferentes (sal aleatório)", async () => {
    const [a, b] = await Promise.all([gerarHashSenha("repetida"), gerarHashSenha("repetida")]);
    assert.notEqual(a, b);
  });

  test("confere a senha certa e recusa a errada", async () => {
    const hash = await gerarHashSenha("correta-123");
    assert.equal(await verificarSenha("correta-123", hash), true);
    assert.equal(await verificarSenha("Correta-123", hash), false);
    assert.equal(await verificarSenha("", hash), false);
  });

  test("aceita senha com acentos e emoji", async () => {
    const senha = "ação-çõ-🎲-dados";
    assert.equal(await verificarSenha(senha, await gerarHashSenha(senha)), true);
  });

  test("recusa hash malformado ou com parâmetros fora do limite, sem lançar", async () => {
    const senha = "x".repeat(12);
    const valido = await gerarHashSenha(senha);
    const casos = [
      "",
      "texto qualquer",
      valido.replace("argon2id", "argon2i"),
      valido.replace("v=19", "v=16"),
      valido.replace("m=19456", "m=9999999"),
      valido.replace("t=2", "t=99"),
      valido.replace("p=1", "p=0"),
      valido.replace(/\$[^$]+$/, "$AAAA"),
    ];
    for (const hash of casos) {
      assert.equal(await verificarSenha(senha, hash), false, hash);
    }
  });

  test("hash fictício é calculado uma vez só", async () => {
    const a = await obterHashFicticio();
    assert.equal(await obterHashFicticio(), a);
    assert.equal(await verificarSenha("", a), false);
  });
});
