CREATE TABLE "acoes_partida" (
	"partida_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"usuario_id" uuid,
	"tipo" text NOT NULL,
	"acao" jsonb NOT NULL,
	"sorteios" jsonb NOT NULL,
	"criada_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "acoes_partida_partida_id_seq_pk" PRIMARY KEY("partida_id","seq")
);
--> statement-breakpoint
CREATE TABLE "participantes" (
	"partida_id" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"cor" text,
	"assento" integer,
	"entrou_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "participantes_partida_id_usuario_id_pk" PRIMARY KEY("partida_id","usuario_id"),
	CONSTRAINT "participantes_partida_cor_unq" UNIQUE("partida_id","cor"),
	CONSTRAINT "participantes_partida_assento_unq" UNIQUE("partida_id","assento"),
	CONSTRAINT "participantes_cor_check" CHECK ("participantes"."cor" in ('branco', 'vermelho', 'azul', 'preto', 'verde', 'amarelo'))
);
--> statement-breakpoint
CREATE TABLE "partidas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"anfitriao_id" uuid NOT NULL,
	"status" text DEFAULT 'aguardando' NOT NULL,
	"parametros" jsonb NOT NULL,
	"convite" text,
	"seq" integer DEFAULT -1 NOT NULL,
	"vencedor_id" uuid,
	"criada_em" timestamp with time zone DEFAULT now() NOT NULL,
	"iniciada_em" timestamp with time zone,
	"encerrada_em" timestamp with time zone,
	"atualizada_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partidas_convite_unique" UNIQUE("convite"),
	CONSTRAINT "partidas_status_check" CHECK ("partidas"."status" in ('aguardando', 'em_andamento', 'encerrada', 'cancelada'))
);
--> statement-breakpoint
CREATE TABLE "snapshots" (
	"partida_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"estado" jsonb NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "snapshots_partida_id_seq_pk" PRIMARY KEY("partida_id","seq")
);
--> statement-breakpoint
ALTER TABLE "acoes_partida" ADD CONSTRAINT "acoes_partida_partida_id_partidas_id_fk" FOREIGN KEY ("partida_id") REFERENCES "public"."partidas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acoes_partida" ADD CONSTRAINT "acoes_partida_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participantes" ADD CONSTRAINT "participantes_partida_id_partidas_id_fk" FOREIGN KEY ("partida_id") REFERENCES "public"."partidas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participantes" ADD CONSTRAINT "participantes_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partidas" ADD CONSTRAINT "partidas_anfitriao_id_usuarios_id_fk" FOREIGN KEY ("anfitriao_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partidas" ADD CONSTRAINT "partidas_vencedor_id_usuarios_id_fk" FOREIGN KEY ("vencedor_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_partida_id_partidas_id_fk" FOREIGN KEY ("partida_id") REFERENCES "public"."partidas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "participantes_usuario_id_idx" ON "participantes" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "partidas_anfitriao_id_idx" ON "partidas" USING btree ("anfitriao_id");