CREATE TABLE "log_usuarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"partida_id" uuid,
	"partida_nome" text,
	"adversarios" jsonb,
	"ip" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "log_usuarios_tipo_check" CHECK ("log_usuarios"."tipo" in ('login', 'partida_criada', 'partida_iniciada'))
);
--> statement-breakpoint
ALTER TABLE "log_usuarios" ADD CONSTRAINT "log_usuarios_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "log_usuarios" ADD CONSTRAINT "log_usuarios_partida_id_partidas_id_fk" FOREIGN KEY ("partida_id") REFERENCES "public"."partidas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "log_usuarios_usuario_criado_idx" ON "log_usuarios" USING btree ("usuario_id","criado_em");