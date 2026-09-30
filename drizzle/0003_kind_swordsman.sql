CREATE TABLE `card_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`paid_at` integer NOT NULL,
	`from_account_id` text,
	`note` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`source_text` text,
	`expense_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`from_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`expense_id`) REFERENCES `expenses`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "card_payments_amount_positive" CHECK("card_payments"."amount_minor" > 0)
);
--> statement-breakpoint
CREATE INDEX `idx_card_payments_account` ON `card_payments` (`account_id`,`deleted_at`,`paid_at`);--> statement-breakpoint
ALTER TABLE `accounts` ADD `opening_owed_minor` integer;--> statement-breakpoint
ALTER TABLE `accounts` ADD `opening_owed_at` integer;--> statement-breakpoint
ALTER TABLE `detected_transactions` ADD `card_payment_id` text REFERENCES card_payments(id) ON DELETE set null;