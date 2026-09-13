CREATE TABLE `capture_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`sender_key` text,
	`package_name` text,
	`issuer` text,
	`outcome` text NOT NULL,
	`direction` text,
	`overrides_gate` text,
	`segments` text NOT NULL,
	`sample_masked` text NOT NULL,
	`times_matched` integer DEFAULT 0 NOT NULL,
	`last_matched_at` integer,
	`is_enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	CONSTRAINT "capture_templates_binding" CHECK("capture_templates"."sender_key" is not null or "capture_templates"."package_name" is not null or "capture_templates"."issuer" is not null),
	CONSTRAINT "capture_templates_outcome" CHECK("capture_templates"."outcome" in ('transaction','transfer','ignore')),
	CONSTRAINT "capture_templates_direction" CHECK("capture_templates"."direction" is null or "capture_templates"."direction" in ('debit','credit'))
);
--> statement-breakpoint
CREATE INDEX `idx_capture_templates_live` ON `capture_templates` (`deleted_at`,`is_enabled`);--> statement-breakpoint
ALTER TABLE `detected_transactions` ADD `templates_rev` integer DEFAULT 0 NOT NULL;