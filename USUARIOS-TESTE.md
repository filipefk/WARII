# Usuários de teste (ambiente de desenvolvimento)

Contas do banco de **desenvolvimento**. Não usar em produção.

## Administrador (seed da migration)

O banco nasce com o administrador, criado pela migration 0001 com senha fixa:

| E-mail | Senha |
|---|---|
| `admin@warii.local` | `FFK.warii1` |

Em produção, trocar essa senha logo depois do primeiro login (tela **Conta**).

## Jogadores

As demais contas são criadas pelo administrador na tela **Administração → Usuários** ("Novo usuário"), que mostra o link de ativação; a senha também pode ser definida ali, pelo botão "Definir senha". Senha usada nas contas de teste:

```
teste-b4e06f174ef0d377
```

O banco foi recriado em 26/11/2026: contas de jogadores criadas antes disso (Ana, Bia, Caio, Duda) não existem mais.

Conta criada depois (pela CLI, senha acima): `bia@warii.test` ("Bia Teste"), usada no teste das pendências em 26/11/2026.

Cada navegador guarda uma sessão só: para jogar com várias contas ao mesmo tempo, use navegadores diferentes ou janelas anônimas.

## Como criar

1. **Pela tela** (recomendado): entrar como administrador e usar **Administração → Usuários**.

2. **Pela CLI** (com o banco no ar; imprime o link de ativação):

```powershell
pnpm --filter @warii/server cli conta:criar bia@warii.test "Bia Teste"
```

## Comandos úteis

```powershell
pnpm --filter @warii/server cli contas:listar
```

Gerar um link para definir a senha (ativação se a conta não tem senha; senão redefinição, válida por 1 h; invalida os anteriores):

```powershell
pnpm --filter @warii/server cli senha:link ana@warii.test
```
