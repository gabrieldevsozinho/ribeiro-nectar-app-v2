CREATE TABLE `auth_contas` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `auth_usuarios`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `auth_contas_usuario_idx` ON `auth_contas` (`user_id`);--> statement-breakpoint
CREATE TABLE `auth_limites` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`count` integer NOT NULL,
	`last_request` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_limites_key_unique` ON `auth_limites` (`key`);--> statement-breakpoint
CREATE TABLE `auth_sessoes` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `auth_usuarios`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_sessoes_token_unique` ON `auth_sessoes` (`token`);--> statement-breakpoint
CREATE INDEX `auth_sessoes_usuario_idx` ON `auth_sessoes` (`user_id`);--> statement-breakpoint
CREATE TABLE `auth_usuarios` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_usuarios_email_unique` ON `auth_usuarios` (`email`);--> statement-breakpoint
CREATE TABLE `auth_verificacoes` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `auth_verificacoes_identificador_idx` ON `auth_verificacoes` (`identifier`);--> statement-breakpoint
CREATE TABLE `codigos_exclusao` (
	`id` text PRIMARY KEY NOT NULL,
	`empresa_id` text NOT NULL,
	`revendedor_id` text NOT NULL,
	`master_id` text NOT NULL,
	`codigo_hash` text NOT NULL,
	`tentativas` integer DEFAULT 0 NOT NULL,
	`expira_em` text NOT NULL,
	`usado_em` text,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`revendedor_id`) REFERENCES `perfis`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`master_id`) REFERENCES `perfis`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `codigos_exclusao_revendedor_idx` ON `codigos_exclusao` (`revendedor_id`);--> statement-breakpoint
CREATE TABLE `empresas` (
	`id` text PRIMARY KEY NOT NULL,
	`nome` text NOT NULL,
	`slug` text NOT NULL,
	`ativa` integer DEFAULT true NOT NULL,
	`limite_masters` integer DEFAULT 3 NOT NULL,
	`limite_revendedores` integer DEFAULT 10 NOT NULL,
	`stripe_customer_id` text,
	`stripe_subscription_id` text,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT "empresas_nome" CHECK(length(trim("empresas"."nome")) between 2 and 120),
	CONSTRAINT "empresas_slug" CHECK(length("empresas"."slug") between 3 and 60
        and "empresas"."slug" not glob '*[^a-z0-9-]*'
        and "empresas"."slug" not like '-%' and "empresas"."slug" not like '%-' and instr("empresas"."slug", '--') = 0
        and "empresas"."slug" not in ('admin', 'api', 'login', 'sair', 'static', 'public', 'assets', 'favicon-ico', 'icones')),
	CONSTRAINT "empresas_limite_masters" CHECK("empresas"."limite_masters" >= 1),
	CONSTRAINT "empresas_limite_revendedores" CHECK("empresas"."limite_revendedores" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `empresas_slug_unique` ON `empresas` (`slug`);--> statement-breakpoint
CREATE TABLE `google_maps_empresa` (
	`empresa_id` text PRIMARY KEY NOT NULL,
	`chave` text,
	`status` text DEFAULT 'nao_configurada' NOT NULL,
	`ultimo_erro` text,
	`validada_em` text,
	`atualizada_por` text,
	`atualizada_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`atualizada_por`) REFERENCES `perfis`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "google_maps_status" CHECK("google_maps_empresa"."status" in ('nao_configurada', 'valida', 'com_erro')),
	CONSTRAINT "google_maps_chave_status" CHECK(("google_maps_empresa"."chave" is null) = ("google_maps_empresa"."status" = 'nao_configurada'))
);
--> statement-breakpoint
CREATE TABLE `itens_venda` (
	`id` text PRIMARY KEY NOT NULL,
	`venda_id` text NOT NULL,
	`empresa_id` text NOT NULL,
	`produto_id` text NOT NULL,
	`quantidade_milesimos` integer NOT NULL,
	`preco_unitario_centavos` integer NOT NULL,
	`subtotal_centavos` integer GENERATED ALWAYS AS (cast(round(quantidade_milesimos * preco_unitario_centavos / 1000.0) as integer)) STORED,
	`adicionado_por` text,
	`adicionado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`venda_id`) REFERENCES `vendas`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`produto_id`) REFERENCES `produtos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`adicionado_por`) REFERENCES `perfis`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "itens_quantidade" CHECK("itens_venda"."quantidade_milesimos" > 0),
	CONSTRAINT "itens_preco" CHECK("itens_venda"."preco_unitario_centavos" >= 0)
);
--> statement-breakpoint
CREATE INDEX `itens_venda_venda_idx` ON `itens_venda` (`venda_id`);--> statement-breakpoint
CREATE TABLE `perfis` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`empresa_id` text,
	`papel` text NOT NULL,
	`nome` text NOT NULL,
	`email` text,
	`telefone` text,
	`endereco` text,
	`compartilha_vendas` integer DEFAULT false NOT NULL,
	`bloqueado` integer DEFAULT false NOT NULL,
	`deve_trocar_senha` integer DEFAULT true NOT NULL,
	`excluido_em` text,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `auth_usuarios`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "perfis_papel" CHECK("perfis"."papel" in ('admin_plataforma', 'master', 'revendedor')),
	CONSTRAINT "perfis_nome" CHECK(length(trim("perfis"."nome")) between 1 and 120),
	CONSTRAINT "perfis_admin_sem_empresa" CHECK(("perfis"."papel" = 'admin_plataforma') = ("perfis"."empresa_id" is null)),
	CONSTRAINT "perfis_compartilha_so_master" CHECK("perfis"."papel" = 'master' or "perfis"."compartilha_vendas" = 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `perfis_user_id_unique` ON `perfis` (`user_id`);--> statement-breakpoint
CREATE INDEX `perfis_empresa_papel_idx` ON `perfis` (`empresa_id`,`papel`);--> statement-breakpoint
CREATE UNIQUE INDEX `perfis_email_unico` ON `perfis` (lower("email")) WHERE "perfis"."excluido_em" is null and "perfis"."email" is not null;--> statement-breakpoint
CREATE TABLE `pontos_venda` (
	`id` text PRIMARY KEY NOT NULL,
	`empresa_id` text NOT NULL,
	`nome` text NOT NULL,
	`cnpj` text,
	`contato` text,
	`telefone` text,
	`logradouro` text NOT NULL,
	`numero` text,
	`bairro` text,
	`cidade` text NOT NULL,
	`uf` text NOT NULL,
	`cep` text,
	`latitude` real,
	`longitude` real,
	`localizacao_status` text DEFAULT 'pendente' NOT NULL,
	`criado_por` text,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`criado_por`) REFERENCES `perfis`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "pontos_nome" CHECK(length(trim("pontos_venda"."nome")) between 1 and 160),
	CONSTRAINT "pontos_cnpj" CHECK("pontos_venda"."cnpj" is null or (length("pontos_venda"."cnpj") = 14 and "pontos_venda"."cnpj" not glob '*[^0-9]*')),
	CONSTRAINT "pontos_logradouro" CHECK(length(trim("pontos_venda"."logradouro")) between 1 and 200),
	CONSTRAINT "pontos_cidade" CHECK(length(trim("pontos_venda"."cidade")) between 1 and 120),
	CONSTRAINT "pontos_uf" CHECK(length("pontos_venda"."uf") = 2 and "pontos_venda"."uf" glob '[A-Z][A-Z]'),
	CONSTRAINT "pontos_cep" CHECK("pontos_venda"."cep" is null or (length("pontos_venda"."cep") = 8 and "pontos_venda"."cep" not glob '*[^0-9]*')),
	CONSTRAINT "pontos_latitude" CHECK("pontos_venda"."latitude" between -90 and 90),
	CONSTRAINT "pontos_longitude" CHECK("pontos_venda"."longitude" between -180 and 180),
	CONSTRAINT "pontos_localizacao_status" CHECK("pontos_venda"."localizacao_status" in ('pendente', 'automatica', 'ajustada')),
	CONSTRAINT "pontos_coordenadas_completas" CHECK(("pontos_venda"."latitude" is null) = ("pontos_venda"."longitude" is null)),
	CONSTRAINT "pontos_status_coordenadas" CHECK(("pontos_venda"."localizacao_status" = 'pendente') = ("pontos_venda"."latitude" is null))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pontos_cnpj_unico` ON `pontos_venda` (`empresa_id`,`cnpj`) WHERE "pontos_venda"."cnpj" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX `pontos_endereco_unico` ON `pontos_venda` (`empresa_id`,lower(trim("logradouro")),lower(trim(case when "numero" is null then '' else "numero" end)),lower(trim("cidade")),`uf`);--> statement-breakpoint
CREATE INDEX `pontos_cidade_idx` ON `pontos_venda` (`empresa_id`,`uf`,`cidade`);--> statement-breakpoint
CREATE TABLE `produtos` (
	`id` text PRIMARY KEY NOT NULL,
	`empresa_id` text NOT NULL,
	`nome` text NOT NULL,
	`unidade` text NOT NULL,
	`preco_sugerido_centavos` integer NOT NULL,
	`ativo` integer DEFAULT true NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "produtos_nome" CHECK(length(trim("produtos"."nome")) between 1 and 120),
	CONSTRAINT "produtos_unidade" CHECK(length(trim("produtos"."unidade")) between 1 and 30),
	CONSTRAINT "produtos_preco" CHECK("produtos"."preco_sugerido_centavos" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `produtos_nome_unidade_unico` ON `produtos` (`empresa_id`,lower(trim("nome")),lower(trim("unidade")));--> statement-breakpoint
CREATE TABLE `vendas` (
	`id` text PRIMARY KEY NOT NULL,
	`empresa_id` text NOT NULL,
	`ponto_venda_id` text NOT NULL,
	`vendedor_id` text NOT NULL,
	`data_venda` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`valor_total_centavos` integer DEFAULT 0 NOT NULL,
	`observacao` text,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ponto_venda_id`) REFERENCES `pontos_venda`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vendedor_id`) REFERENCES `perfis`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "vendas_observacao" CHECK("vendas"."observacao" is null or length("vendas"."observacao") <= 500)
);
--> statement-breakpoint
CREATE INDEX `vendas_empresa_data_idx` ON `vendas` (`empresa_id`,`data_venda`);--> statement-breakpoint
CREATE INDEX `vendas_ponto_data_idx` ON `vendas` (`ponto_venda_id`,`data_venda`);--> statement-breakpoint
CREATE INDEX `vendas_vendedor_data_idx` ON `vendas` (`vendedor_id`,`data_venda`);