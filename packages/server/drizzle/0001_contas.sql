CREATE TABLE "sessoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"token_hash" "bytea" NOT NULL,
	"criada_em" timestamp with time zone DEFAULT now() NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"ultimo_uso_em" timestamp with time zone DEFAULT now() NOT NULL,
	"revogada_em" timestamp with time zone,
	"ip" text,
	"user_agent" text,
	CONSTRAINT "sessoes_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "tokens_senha" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"token_hash" "bytea" NOT NULL,
	"finalidade" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"usado_em" timestamp with time zone,
	CONSTRAINT "tokens_senha_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "tokens_senha_finalidade_check" CHECK ("tokens_senha"."finalidade" in ('ativacao', 'redefinicao'))
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" "citext" NOT NULL,
	"nome" text NOT NULL,
	"senha_hash" text,
	"admin" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuarios_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "sessoes" ADD CONSTRAINT "sessoes_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tokens_senha" ADD CONSTRAINT "tokens_senha_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sessoes_usuario_id_idx" ON "sessoes" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "tokens_senha_usuario_id_idx" ON "tokens_senha" USING btree ("usuario_id");--> statement-breakpoint
-- Seed: o administrador inicial, com senha fixa (hash Argon2id no formato de auth/senha.ts; a senha
-- em claro está no CLAUDE.md). Trocar a senha depois do primeiro login (tela Conta); e-mail e nome
-- podem ser trocados na tela de usuários.
INSERT INTO "usuarios" ("email", "nome", "senha_hash", "admin") VALUES ('admin@warii.local', 'Administrador', '$argon2id$v=19$m=19456,t=2,p=1$3sNCb2EUnVow98jxHA6pDQ$9WzDExjB+Cxe83VhGNwB1/L41sVmoTR79l5xneWqnmo', true);