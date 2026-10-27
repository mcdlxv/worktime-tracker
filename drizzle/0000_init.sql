CREATE TABLE `employees` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `time_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`employee_id` integer NOT NULL,
	`description` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ended_after_started" CHECK(ended_at IS NULL OR ended_at >= started_at)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `one_running_timer_per_employee` ON `time_entries` (`employee_id`) WHERE ended_at IS NULL;--> statement-breakpoint
CREATE INDEX `time_entries_by_employee_start` ON `time_entries` (`employee_id`,`started_at`);