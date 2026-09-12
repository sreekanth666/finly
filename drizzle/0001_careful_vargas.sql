CREATE TABLE `captured_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`package_name` text,
	`sender` text,
	`title` text,
	`body` text NOT NULL,
	`posted_at` integer NOT NULL,
	`received_at` integer NOT NULL,
	`content_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	CONSTRAINT "captured_messages_source" CHECK("captured_messages"."source" in ('notification','paste','share'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_captured_hash` ON `captured_messages` (`content_hash`);--> statement-breakpoint
CREATE INDEX `idx_captured_received` ON `captured_messages` (`deleted_at`,"received_at" desc);--> statement-breakpoint
CREATE TABLE `detected_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`kind` text NOT NULL,
	`direction` text,
	`amount_minor` integer,
	`currency` text,
	`amount_candidates` text DEFAULT '[]' NOT NULL,
	`occurred_at` integer NOT NULL,
	`date_confidence` text NOT NULL,
	`counterparty` text,
	`item` text NOT NULL,
	`instrument_type` text,
	`instrument_tail` text,
	`issuer` text,
	`reference` text,
	`channel` text,
	`confidence` text NOT NULL,
	`reasons` text DEFAULT '[]' NOT NULL,
	`suggested_category_id` text,
	`suggested_account_id` text,
	`suggested_rule_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`duplicate_of` text,
	`expense_id` text,
	`settlement_id` text,
	`parser_version` integer NOT NULL,
	`is_edited` integer DEFAULT false NOT NULL,
	`resolved_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`message_id`) REFERENCES `captured_messages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`suggested_category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`suggested_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`duplicate_of`) REFERENCES `detected_transactions`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`expense_id`) REFERENCES `expenses`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`settlement_id`) REFERENCES `settlements`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "detected_kind" CHECK("detected_transactions"."kind" in ('transaction','transfer','refund','failed','upcoming','statement','otp','balance','promo','reminder','unknown')),
	CONSTRAINT "detected_direction" CHECK("detected_transactions"."direction" is null or "detected_transactions"."direction" in ('debit','credit')),
	CONSTRAINT "detected_amount_positive" CHECK("detected_transactions"."amount_minor" is null or "detected_transactions"."amount_minor" > 0),
	CONSTRAINT "detected_date_confidence" CHECK("detected_transactions"."date_confidence" in ('exact','day_only','fallback_received')),
	CONSTRAINT "detected_instrument_type" CHECK("detected_transactions"."instrument_type" is null or "detected_transactions"."instrument_type" in ('card','account','wallet')),
	CONSTRAINT "detected_channel" CHECK("detected_transactions"."channel" is null or "detected_transactions"."channel" in ('upi','card','neft','imps','rtgs','atm','autopay','emi')),
	CONSTRAINT "detected_confidence" CHECK("detected_transactions"."confidence" in ('high','medium','low')),
	CONSTRAINT "detected_status" CHECK("detected_transactions"."status" in ('pending','confirmed','dismissed','duplicate','not_transaction','settled'))
);
--> statement-breakpoint
CREATE INDEX `idx_detected_status` ON `detected_transactions` (`status`,`deleted_at`,"occurred_at" desc);--> statement-breakpoint
CREATE INDEX `idx_detected_reference` ON `detected_transactions` (`reference`);--> statement-breakpoint
CREATE INDEX `idx_detected_expense` ON `detected_transactions` (`expense_id`);--> statement-breakpoint
CREATE INDEX `idx_detected_message` ON `detected_transactions` (`message_id`);--> statement-breakpoint
ALTER TABLE `expenses` ADD `source` text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `expenses` ADD `source_text` text;