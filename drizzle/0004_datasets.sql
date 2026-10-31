CREATE TABLE "dataset" (
	"user_id" text NOT NULL,
	"id" text NOT NULL,
	"name" text NOT NULL,
	"uploaded_at" timestamp with time zone NOT NULL,
	CONSTRAINT "dataset_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "statement_row_dataset" (
	"row_id" bigint NOT NULL,
	"user_id" text NOT NULL,
	"dataset_id" text NOT NULL,
	CONSTRAINT "statement_row_dataset_row_id_dataset_id_pk" PRIMARY KEY("row_id","dataset_id")
);
--> statement-breakpoint
ALTER TABLE "dataset" ADD CONSTRAINT "dataset_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statement_row_dataset" ADD CONSTRAINT "statement_row_dataset_row_id_statement_row_id_fk" FOREIGN KEY ("row_id") REFERENCES "public"."statement_row"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statement_row_dataset" ADD CONSTRAINT "statement_row_dataset_user_id_dataset_id_dataset_user_id_id_fk" FOREIGN KEY ("user_id","dataset_id") REFERENCES "public"."dataset"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "statement_row_dataset_dataset" ON "statement_row_dataset" USING btree ("user_id","dataset_id");