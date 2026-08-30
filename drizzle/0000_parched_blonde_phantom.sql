CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`issuer` text,
	`last4` text,
	`credit_limit_minor` integer,
	`statement_day` integer,
	`color_token` text DEFAULT 'accent' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_archived` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	CONSTRAINT "accounts_type" CHECK("accounts"."type" in ('credit_card','bank','cash','wallet')),
	CONSTRAINT "accounts_statement_day" CHECK("accounts"."statement_day" is null or ("accounts"."statement_day" between 1 and 31)),
	CONSTRAINT "accounts_card_needs_limit" CHECK("accounts"."type" <> 'credit_card' or "accounts"."credit_limit_minor" is not null)
);
--> statement-breakpoint
CREATE INDEX `idx_accounts_order` ON `accounts` (`sort_order`);--> statement-breakpoint
CREATE TABLE `budgets` (
	`id` text PRIMARY KEY NOT NULL,
	`period` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`carry_over_minor` integer DEFAULT 0 NOT NULL,
	`carry_recomputed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_budgets_period` ON `budgets` (`period`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`icon` text NOT NULL,
	`color_token` text NOT NULL,
	`chart_tone` text NOT NULL,
	`is_system` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_archived` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_categories_order` ON `categories` (`sort_order`);--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`occurred_at` integer NOT NULL,
	`budget_period` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`currency` text DEFAULT 'INR' NOT NULL,
	`item` text NOT NULL,
	`note` text,
	`category_id` text,
	`account_id` text,
	`counts_to_budget` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "expenses_amount_positive" CHECK("expenses"."amount_minor" > 0)
);
--> statement-breakpoint
CREATE INDEX `idx_expenses_period` ON `expenses` (`budget_period`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_expenses_occurred` ON `expenses` ("occurred_at" desc);--> statement-breakpoint
CREATE INDEX `idx_expenses_account` ON `expenses` (`account_id`,"occurred_at" desc);--> statement-breakpoint
CREATE INDEX `idx_expenses_category` ON `expenses` (`category_id`,`budget_period`);--> statement-breakpoint
CREATE INDEX `idx_expenses_period_budget` ON `expenses` (`budget_period`,`counts_to_budget`,`deleted_at`);--> statement-breakpoint
CREATE TABLE `rule_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`rule_id` text NOT NULL,
	`type` text NOT NULL,
	`value` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`rule_id`) REFERENCES `rules`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `rule_conditions` (
	`id` text PRIMARY KEY NOT NULL,
	`rule_id` text NOT NULL,
	`field` text NOT NULL,
	`operator` text NOT NULL,
	`value` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`rule_id`) REFERENCES `rules`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `rules` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`is_enabled` integer DEFAULT true NOT NULL,
	`match_mode` text DEFAULT 'all' NOT NULL,
	`times_applied` integer DEFAULT 0 NOT NULL,
	`last_applied_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	CONSTRAINT "rules_match_mode" CHECK("rules"."match_mode" in ('all','any'))
);
--> statement-breakpoint
CREATE INDEX `idx_rules_priority` ON `rules` ("priority" desc,`deleted_at`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settlements` (
	`id` text PRIMARY KEY NOT NULL,
	`expense_id` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`settled_at` integer NOT NULL,
	`account_id` text,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`expense_id`) REFERENCES `expenses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "settlements_amount_positive" CHECK("settlements"."amount_minor" > 0)
);
--> statement-breakpoint
CREATE INDEX `idx_settlements_expense` ON `settlements` (`expense_id`,`deleted_at`);