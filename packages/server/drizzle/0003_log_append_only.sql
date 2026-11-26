-- Log das partidas só de inclusão: nenhuma ação gravada pode ser alterada ou apagada.
-- (TRUNCATE não dispara triggers de linha; os testes o usam para limpar o banco.)
-- Única exceção: o administrador apaga uma partida inteira (admin/partidas.ts), numa transação
-- que liga `warii.apagar_partida` com set_config(..., true), que só vale até o fim dela.
CREATE FUNCTION recusar_alteracao_do_log() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('warii.apagar_partida', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'acoes_partida é só de inclusão (% recusado)', TG_OP;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER acoes_partida_somente_inclusao
BEFORE UPDATE OR DELETE ON acoes_partida
FOR EACH ROW EXECUTE FUNCTION recusar_alteracao_do_log();
