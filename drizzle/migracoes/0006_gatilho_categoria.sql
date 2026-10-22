-- Segunda camada (igual aos outros gatilhos): a categoria de um produto precisa ser da mesma
-- empresa do produto, mesmo que uma rota tenha um erro.
CREATE TRIGGER `produtos_categoria_conferir_inserir` BEFORE INSERT ON `produtos`
WHEN NEW.categoria_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'EMPRESA_INVALIDA: categoria de outra empresa.')
  WHERE NOT EXISTS (
    SELECT 1 FROM categorias_produto c WHERE c.id = NEW.categoria_id AND c.empresa_id = NEW.empresa_id
  );
END;
--> statement-breakpoint

CREATE TRIGGER `produtos_categoria_conferir_alterar` BEFORE UPDATE OF categoria_id, empresa_id ON `produtos`
WHEN NEW.categoria_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'EMPRESA_INVALIDA: categoria de outra empresa.')
  WHERE NOT EXISTS (
    SELECT 1 FROM categorias_produto c WHERE c.id = NEW.categoria_id AND c.empresa_id = NEW.empresa_id
  );
END;
