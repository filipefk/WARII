// Dados estáticos do engine conferidos contra WARII.md (o mesmo que `pnpm conferir`).

import assert from "node:assert/strict";
import { test } from "node:test";

import { conferirDados } from "../src/index.js";

test("dados estáticos batem com WARII.md", () => {
  assert.deepStrictEqual(conferirDados(), []);
});
