CREATE TABLE "category_rule" (
	"user_id" text NOT NULL,
	"id" text NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"conditions" jsonb NOT NULL,
	"builtin" boolean DEFAULT false NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "category_rule_user_id_id_pk" PRIMARY KEY("user_id","id"),
	CONSTRAINT "category_rule_position" UNIQUE("user_id","position")
);
--> statement-breakpoint
CREATE TABLE "preference" (
	"user_id" text PRIMARY KEY NOT NULL,
	"chart_mode" text DEFAULT 'donut' NOT NULL,
	"sort_key" text DEFAULT 'date' NOT NULL,
	"sort_dir" smallint DEFAULT -1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "statement_row" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "statement_row_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"status" text NOT NULL,
	"date_str" text NOT NULL,
	"description" text NOT NULL,
	"debit" text NOT NULL,
	"credit" text NOT NULL,
	"person" text NOT NULL,
	"ordinal" integer NOT NULL,
	"category_override" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "statement_row_identity" UNIQUE("user_id","date_str","description","debit","credit","person","ordinal")
);
--> statement-breakpoint
ALTER TABLE "category_rule" ADD CONSTRAINT "category_rule_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preference" ADD CONSTRAINT "preference_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statement_row" ADD CONSTRAINT "statement_row_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;