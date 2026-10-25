CREATE TABLE `detector_labels` (
	`key` text PRIMARY KEY NOT NULL,
	`confirmed` integer DEFAULT 0 NOT NULL,
	`not_transaction` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
ALTER TABLE `detected_transactions` ADD `model_score` real;--> statement-breakpoint
ALTER TABLE `detected_transactions` ADD `model_key` text;--> statement-breakpoint
ALTER TABLE `detected_transactions` ADD `model_version` integer DEFAULT 0 NOT NULL;