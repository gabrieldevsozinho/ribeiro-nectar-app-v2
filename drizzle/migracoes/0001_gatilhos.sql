-- =============================================================================
-- Ribeiro Néctar — gatilhos de integridade (D1 / SQLite)
--
-- Segunda proteção, além da API: mesmo que uma rota tenha um erro, o banco não
-- aceita dados de uma empresa misturados com os de outra, não deixa alterar nem
-- apagar vendas e itens, recalcula o total e respeita o limite do plano.
-- As mensagens começam com um código (LIMITE_PLANO, ITEM_IMUTAVEL…) que a API traduz.
-- =============================================================================

-- Toda empresa nasce com a configuração do Google Maps "não configurada".
CREATE TRIGGER `empresas_config_google_maps` AFTER INSERT ON `empresas`
BEGIN
  INSERT INTO google_maps_empresa (empresa_id) VALUES (NEW.id);
END;
--> statement-breakpoint

-- Limite do plano. Bloqueado conta no limite; excluído libera a vaga.
CREATE TRIGGER `perfis_limite_plano_inserir` BEFORE INSERT ON `perfis`
WHEN NEW.papel <> 'admin_plataforma' AND NEW.excluido_em IS NULL
BEGIN
  SELECT RAISE(ABORT, 'LIMITE_PLANO: limite do plano atingido.')
  WHERE (
    SELECT count(*) FROM perfis p
    WHERE p.empresa_id = NEW.empresa_id AND p.papel = NEW.papel AND p.excluido_em IS NULL
  ) >= (
    SELECT CASE WHEN NEW.papel = 'master' THEN e.limite_masters ELSE e.limite_revendedores END
    FROM empresas e WHERE e.id = NEW.empresa_id
  );
END;
--> statement-breakpoint

CREATE TRIGGER `perfis_limite_plano_alterar` BEFORE UPDATE OF papel, empresa_id, excluido_em ON `perfis`
WHEN NEW.papel <> 'admin_plataforma' AND NEW.excluido_em IS NULL
  AND (OLD.excluido_em IS NOT NULL OR OLD.papel IS NOT NEW.papel OR OLD.empresa_id IS NOT NEW.empresa_id)
BEGIN
  SELECT RAISE(ABORT, 'LIMITE_PLANO: limite do plano atingido.')
  WHERE (
    SELECT count(*) FROM perfis p
    WHERE p.empresa_id = NEW.empresa_id AND p.papel = NEW.papel AND p.excluido_em IS NULL AND p.id <> NEW.id
  ) >= (
    SELECT CASE WHEN NEW.papel = 'master' THEN e.limite_masters ELSE e.limite_revendedores END
    FROM empresas e WHERE e.id = NEW.empresa_id
  );
END;
--> statement-breakpoint

-- Venda: ponto e vendedor precisam ser da mesma empresa; o total começa em zero.
CREATE TRIGGER `vendas_conferir_inserir` BEFORE INSERT ON `vendas`
BEGIN
  SELECT RAISE(ABORT, 'EMPRESA_INVALIDA: ponto de venda de outra empresa.')
  WHERE NOT EXISTS (
    SELECT 1 FROM pontos_venda pv WHERE pv.id = NEW.ponto_venda_id AND pv.empresa_id = NEW.empresa_id
  );
  SELECT RAISE(ABORT, 'EMPRESA_INVALIDA: vendedor de outra empresa.')
  WHERE NOT EXISTS (
    SELECT 1 FROM perfis p
    WHERE p.id = NEW.vendedor_id AND p.empresa_id = NEW.empresa_id AND p.papel IN ('master', 'revendedor')
  );
  SELECT RAISE(ABORT, 'VENDA_IMUTAVEL: o valor total é calculado a partir dos itens.')
  WHERE NEW.valor_total_centavos <> 0;
END;
--> statement-breakpoint

CREATE TRIGGER `vendas_imutavel_alterar` BEFORE UPDATE ON `vendas`
WHEN NEW.empresa_id IS NOT OLD.empresa_id
  OR NEW.ponto_venda_id IS NOT OLD.ponto_venda_id
  OR NEW.vendedor_id IS NOT OLD.vendedor_id
  OR NEW.data_venda IS NOT OLD.data_venda
BEGIN
  SELECT RAISE(ABORT, 'VENDA_IMUTAVEL: os dados da venda não podem ser alterados.');
END;
--> statement-breakpoint

CREATE TRIGGER `vendas_imutavel_apagar` BEFORE DELETE ON `vendas`
BEGIN
  SELECT RAISE(ABORT, 'VENDA_IMUTAVEL: vendas não podem ser apagadas.');
END;
--> statement-breakpoint

-- O total é sempre a soma dos itens: se alguém gravar outro valor, ele volta ao certo.
CREATE TRIGGER `vendas_total_recalcular` AFTER UPDATE OF valor_total_centavos ON `vendas`
WHEN NEW.valor_total_centavos IS NOT (
  SELECT coalesce(sum(i.subtotal_centavos), 0) FROM itens_venda i WHERE i.venda_id = NEW.id
)
BEGIN
  UPDATE vendas
     SET valor_total_centavos = (
       SELECT coalesce(sum(i.subtotal_centavos), 0) FROM itens_venda i WHERE i.venda_id = NEW.id
     )
   WHERE id = NEW.id;
END;
--> statement-breakpoint

-- Itens: a empresa e o produto precisam bater com a venda; produto desativado não entra.
CREATE TRIGGER `itens_venda_conferir` BEFORE INSERT ON `itens_venda`
BEGIN
  SELECT RAISE(ABORT, 'EMPRESA_INVALIDA: venda de outra empresa.')
  WHERE NOT EXISTS (
    SELECT 1 FROM vendas v WHERE v.id = NEW.venda_id AND v.empresa_id = NEW.empresa_id
  );
  SELECT RAISE(ABORT, 'EMPRESA_INVALIDA: produto de outra empresa.')
  WHERE NOT EXISTS (
    SELECT 1 FROM produtos pr WHERE pr.id = NEW.produto_id AND pr.empresa_id = NEW.empresa_id
  );
  SELECT RAISE(ABORT, 'PRODUTO_INATIVO: produto fora do catálogo.')
  WHERE NOT EXISTS (
    SELECT 1 FROM produtos pr WHERE pr.id = NEW.produto_id AND pr.ativo = 1
  );
END;
--> statement-breakpoint

-- Itens são só de acréscimo: nem o servidor altera ou apaga.
CREATE TRIGGER `itens_venda_imutavel_alterar` BEFORE UPDATE ON `itens_venda`
BEGIN
  SELECT RAISE(ABORT, 'ITEM_IMUTAVEL: itens de venda não podem ser alterados nem removidos.');
END;
--> statement-breakpoint

CREATE TRIGGER `itens_venda_imutavel_apagar` BEFORE DELETE ON `itens_venda`
BEGIN
  SELECT RAISE(ABORT, 'ITEM_IMUTAVEL: itens de venda não podem ser alterados nem removidos.');
END;
--> statement-breakpoint

CREATE TRIGGER `itens_venda_total` AFTER INSERT ON `itens_venda`
BEGIN
  UPDATE vendas
     SET valor_total_centavos = (
       SELECT coalesce(sum(i.subtotal_centavos), 0) FROM itens_venda i WHERE i.venda_id = NEW.venda_id
     )
   WHERE id = NEW.venda_id;
END;
