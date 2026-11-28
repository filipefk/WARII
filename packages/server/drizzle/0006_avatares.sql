CREATE TABLE "avatares" (
	"usuario_id" uuid PRIMARY KEY NOT NULL,
	"tipo" text NOT NULL,
	"imagem" "bytea" NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN "avatar_versao" integer;--> statement-breakpoint
ALTER TABLE "avatares" ADD CONSTRAINT "avatares_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;