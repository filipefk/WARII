import { defineConfig } from "tsup";

export default defineConfig({
  // index: o servidor; cli: comandos de administração das contas (node dist/cli.js).
  entry: ["src/index.ts", "src/cli.ts"],
  format: ["esm"],
  platform: "node",
  target: "node24",
  clean: true,
  sourcemap: true,
  // Os pacotes do monorepo são código-fonte TS: entram no bundle; o resto fica em node_modules.
  noExternal: [/^@warii\//],
});
