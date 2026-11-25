// No navegador, o zod não compila validadores com `new Function`: a CSP do site (sem 'unsafe-eval')
// recusaria e registraria uma violação a cada carga. Precisa rodar antes de qualquer schema ser
// criado (o zod decide na criação), por isso é o primeiro import do index.ts. O servidor mantém a
// compilação, que é mais rápida.
import { z } from "zod";

if ("window" in globalThis) z.config({ jitless: true });
