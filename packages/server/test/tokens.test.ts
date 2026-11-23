// Tokens opacos e o HMAC guardado no banco. Não usa banco.
import "./ambiente.js";

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { esquemaTokenSenha } from "@warii/shared";
import { formatoDeTokenValido, gerarToken, hashDoToken } from "../src/auth/tokens.js";

describe("tokens", () => {
  test("gera 32 bytes em base64url (43 caracteres) e não repete", () => {
    const tokens = new Set(Array.from({ length: 1000 }, () => gerarToken()));
    assert.equal(tokens.size, 1000);
    for (const token of tokens) {
      assert.equal(formatoDeTokenValido(token), true);
      assert.equal(esquemaTokenSenha.safeParse(token).success, true);
    }
  });

  test("o hash é determinístico, tem 32 bytes e é diferente do token", () => {
    const token = gerarToken();
    const hash = hashDoToken(token);
    assert.equal(hash.length, 32);
    assert.deepEqual(hashDoToken(token), hash);
    assert.notDeepEqual(hashDoToken(gerarToken()), hash);
    assert.notEqual(hash.toString("base64url"), token);
  });

  test("recusa formatos inválidos", () => {
    const token = gerarToken();
    const invalidos = ["", token.slice(1), `${token}a`, `${token.slice(1)}=`, `${token.slice(1)}+`];
    for (const invalido of invalidos) {
      assert.equal(formatoDeTokenValido(invalido), false, invalido);
    }
  });
});
