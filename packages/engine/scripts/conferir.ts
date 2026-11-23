// Confere os dados estáticos do engine contra WARII.md: `pnpm conferir` na raiz.

import {
  CARTAS_DE_TROCA,
  conferirDados,
  FRONTEIRAS,
  OBJETIVOS,
  TERRITORIOS,
} from "../src/index.js";

const erros = conferirDados();

if (erros.length > 0) {
  console.error(`Dados com ${erros.length} problema(s):`);
  for (const erro of erros) console.error(`  - ${erro}`);
  process.exitCode = 1;
} else {
  console.log(
    `Dados conferidos: ${TERRITORIOS.length} territórios, ${FRONTEIRAS.length} fronteiras, ` +
      `${CARTAS_DE_TROCA.length} cartas de troca, ${OBJETIVOS.length} objetivos.`,
  );
}
