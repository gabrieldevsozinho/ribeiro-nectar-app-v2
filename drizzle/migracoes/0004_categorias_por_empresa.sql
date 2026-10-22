CREATE TABLE `categorias_produto` (
	`id` text PRIMARY KEY NOT NULL,
	`empresa_id` text NOT NULL,
	`nome` text NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "categorias_produto_nome" CHECK(length(trim("categorias_produto"."nome")) between 1 and 60)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categorias_produto_nome_unico` ON `categorias_produto` (`empresa_id`,lower(trim("nome")));--> statement-breakpoint
ALTER TABLE `produtos` ADD `categoria_id` text;--> statement-breakpoint

-- Toda empresa já existente ganha o conjunto inicial de categorias (o mesmo que criarEmpresa()
-- passa a dar às empresas novas, no Worker). O master edita ou exclui à vontade dali em diante.
INSERT INTO `categorias_produto` (`id`, `empresa_id`, `nome`)
SELECT
  lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(6))),
  e.id,
  v.nome
FROM `empresas` e
CROSS JOIN (
  SELECT column1 AS nome FROM (
    VALUES ('Mel'), ('Mel cremoso'), ('Favo de mel'), ('Própolis'), ('Pólen'), ('Geleia real'),
      ('Cera de abelha'), ('Hidromel'), ('Cosmético'), ('Kit / combo'), ('Outro')
  )
) v;--> statement-breakpoint

-- Liga cada produto já cadastrado à categoria nova da própria empresa, pelo valor antigo.
UPDATE `produtos`
SET `categoria_id` = (
  SELECT c.id FROM `categorias_produto` c
  WHERE c.empresa_id = produtos.empresa_id
    AND lower(c.nome) = CASE produtos.categoria
      WHEN 'mel' THEN 'mel'
      WHEN 'mel_cremoso' THEN 'mel cremoso'
      WHEN 'favo_de_mel' THEN 'favo de mel'
      WHEN 'propolis' THEN 'própolis'
      WHEN 'polen' THEN 'pólen'
      WHEN 'geleia_real' THEN 'geleia real'
      WHEN 'cera' THEN 'cera de abelha'
      WHEN 'hidromel' THEN 'hidromel'
      WHEN 'cosmetico' THEN 'cosmético'
      WHEN 'kit' THEN 'kit / combo'
      ELSE 'outro'
    END
);