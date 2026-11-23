-- Log das partidas só de inclusão: nenhuma ação gravada pode ser alterada ou apagada.
-- (TRUNCATE não dispara triggers de linha; os testes o usam para limpar o banco.)
CREATE FUNCTION recusar_alteracao_do_log() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'acoes_partida é só de inclusão (% recusado)', TG_OP;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER acoes_partida_somente_inclusao
BEFORE UPDATE OR DELETE ON acoes_partida
FOR EACH ROW EXECUTE FUNCTION recusar_alteracao_do_log();
