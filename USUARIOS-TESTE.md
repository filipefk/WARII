# Usuários de teste (ambiente de desenvolvimento)

Contas criadas no banco de **desenvolvimento** para testar o lobby (etapa 8). Não usar em produção.

**Senha (a mesma para todas as contas):**

```
teste-b4e06f174ef0d377
```

| E-mail | Nome |
|---|---|
| `ana@warii.test` | Ana Teste |
| `bia@warii.test` | Bia Teste |
| `caio@warii.test` | Caio Teste |
| `duda@warii.test` | Duda Teste |

A Ana é anfitriã da partida "Teste do lobby" (já iniciada, com Ana, Bia e Caio).

Cada navegador guarda uma sessão só: para jogar com várias contas ao mesmo tempo, use navegadores diferentes ou janelas anônimas.

## Como foram criadas

1. Criar a conta pela CLI (com o banco no ar). Cada comando imprime um link de ativação de uso único (`http://localhost:5173/definir-senha#token=…`, válido por 72 h):

   ```powershell
   pnpm --filter @warii/server cli conta:criar ana@warii.test "Ana Teste"
   pnpm --filter @warii/server cli conta:criar bia@warii.test "Bia Teste"
   pnpm --filter @warii/server cli conta:criar caio@warii.test "Caio Teste"
   pnpm --filter @warii/server cli conta:criar duda@warii.test "Duda Teste"
   ```

2. Definir a senha com o token do link:
   - **Ana**: abrindo o link no navegador (com `pnpm dev` rodando) e preenchendo a página "Definir senha".
   - **Bia, Caio e Duda**: chamando a API diretamente (o `Origin` precisa ser o `URL_PUBLICA`), trocando `<TOKEN>` pelo token do link:

     ```powershell
     curl.exe -s -H "content-type: application/json" -H "origin: http://localhost:5173" -d '{\"token\":\"<TOKEN>\",\"senha\":\"teste-b4e06f174ef0d377\"}' http://localhost:5173/api/auth/senha/definir
     ```

## Comandos úteis

```powershell
pnpm --filter @warii/server cli contas:listar
```

Gerar um link de redefinição de senha (válido por 1 h; invalida os anteriores):

```powershell
pnpm --filter @warii/server cli senha:link ana@warii.test
```
