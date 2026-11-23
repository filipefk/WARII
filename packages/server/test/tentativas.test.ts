// Atraso progressivo e bloqueio do login, com relógio simulado. Não usa banco.
import "./ambiente.js";

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, mock, test } from "node:test";

import {
  atrasoAntesDaTentativa,
  bloqueioRestante,
  registrarFalha,
  registrarSucesso,
} from "../src/auth/tentativas.js";

const MINUTO = 60 * 1000;
const IP = "203.0.113.7";

// Cada teste usa um e-mail próprio: o contador é global ao módulo.
let sequencia = 0;
function emailNovo(): string {
  sequencia += 1;
  return `tentativas${sequencia}@teste.local`;
}

function falhar(email: string, vezes: number, ip = IP): void {
  for (let i = 0; i < vezes; i += 1) registrarFalha(email, ip);
}

describe("tentativas de login", () => {
  beforeEach(() => mock.timers.enable({ apis: ["Date"], now: 1_000_000 }));
  afterEach(() => mock.timers.reset());

  test("sem atraso nas duas primeiras falhas, depois cresce até 5 s", () => {
    const email = emailNovo();
    const atrasos: number[] = [];
    for (let i = 0; i < 9; i += 1) {
      atrasos.push(atrasoAntesDaTentativa(email, IP));
      registrarFalha(email, IP);
    }
    assert.deepEqual(atrasos, [0, 0, 500, 1000, 2000, 4000, 5000, 5000, 5000]);
  });

  test("bloqueia por 15 min a partir da 10ª falha", () => {
    const email = emailNovo();
    falhar(email, 9);
    assert.equal(bloqueioRestante(email, IP), 0);
    registrarFalha(email, IP);
    assert.equal(bloqueioRestante(email, IP), 15 * MINUTO);
    mock.timers.tick(14 * MINUTO);
    assert.equal(bloqueioRestante(email, IP), MINUTO);
    mock.timers.tick(MINUTO);
    assert.equal(bloqueioRestante(email, IP), 0);
  });

  test("o e-mail é comparado sem diferenciar maiúsculas", () => {
    const email = emailNovo();
    falhar(email.toUpperCase(), 3);
    assert.equal(atrasoAntesDaTentativa(email, IP), 1000);
  });

  test("conta por e-mail + IP: outro IP ou outro e-mail não herdam as falhas", () => {
    const email = emailNovo();
    falhar(email, 10);
    assert.ok(bloqueioRestante(email, IP) > 0);
    assert.equal(bloqueioRestante(email, "198.51.100.1"), 0);
    assert.equal(atrasoAntesDaTentativa(emailNovo(), IP), 0);
  });

  test("sucesso zera o contador", () => {
    const email = emailNovo();
    falhar(email, 5);
    registrarSucesso(email, IP);
    assert.equal(atrasoAntesDaTentativa(email, IP), 0);
  });

  test("falhas antigas (mais de 1 h sem novas) são esquecidas", () => {
    const email = emailNovo();
    falhar(email, 5);
    mock.timers.tick(61 * MINUTO);
    assert.equal(atrasoAntesDaTentativa(email, IP), 0);
  });
});
