-- Migration inicial: só infraestrutura. As tabelas entram a partir da etapa 5.
-- citext: texto que compara sem diferenciar maiúsculas/minúsculas (e-mail dos usuários).
-- É uma extensão "trusted" desde o PostgreSQL 13: basta ser dono do database.
CREATE EXTENSION IF NOT EXISTS citext;
