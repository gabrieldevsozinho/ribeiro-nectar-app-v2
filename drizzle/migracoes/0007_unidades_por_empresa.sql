CREATE TABLE `unidades_produto` (
	`id` text PRIMARY KEY NOT NULL,
	`empresa_id` text NOT NULL,
	`nome` text NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "unidades_produto_nome" CHECK(length(trim("unidades_produto"."nome")) between 1 and 30)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unidades_produto_nome_unico` ON `unidades_produto` (`empresa_id`,lower(trim("nome")));--> statement-breakpoint

-- Toda empresa já existente ganha o conjunto inicial de unidades (o mesmo que criarEmpresa()
-- passa a dar às empresas novas, no Worker). O master cria ou exclui as da própria empresa dali em diante.
INSERT INTO `unidades_produto` (`id`, `empresa_id`, `nome`)
SELECT
  lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(6))),
  e.id,
  v.nome
FROM `empresas` e
CROSS JOIN (
  SELECT column1 AS nome FROM (
    VALUES ('pote 500 g'), ('pote 1 kg'), ('bisnaga 280 g'), ('bisnaga 500 g'),
      ('vidro 450 g'), ('vidro 750 g'), ('frasco 30 ml'), ('frasco 60 ml'),
      ('favo 200 g'), ('kg'), ('unidade')
  )
) v;--> statement-breakpoint

-- Garante que as unidades em uso nos produtos já cadastrados (fora da lista padrão) também
-- apareçam no cadastro, para o master poder escolhê-las na edição e, se quiser, excluí-las.
INSERT INTO `unidades_produto` (`id`, `empresa_id`, `nome`)
SELECT
  lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(6))),
  p.empresa_id,
  trim(p.unidade)
FROM `produtos` p
WHERE NOT EXISTS (
  SELECT 1 FROM `unidades_produto` u
  WHERE u.empresa_id = p.empresa_id AND lower(trim(u.nome)) = lower(trim(p.unidade))
)
GROUP BY p.empresa_id, lower(trim(p.unidade));
