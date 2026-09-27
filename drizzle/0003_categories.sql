CREATE TABLE "category" (
	"user_id" text NOT NULL,
	"id" text NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"builtin" boolean DEFAULT false NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "category_user_id_id_pk" PRIMARY KEY("user_id","id"),
	CONSTRAINT "category_position" UNIQUE("user_id","position")
);
--> statement-breakpoint
CREATE TABLE "rule" (
	"user_id" text NOT NULL,
	"id" text NOT NULL,
	"category_id" text NOT NULL,
	"conditions" jsonb NOT NULL,
	"builtin" boolean DEFAULT false NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "rule_user_id_id_pk" PRIMARY KEY("user_id","id"),
	CONSTRAINT "rule_position" UNIQUE("user_id","position")
);
--> statement-breakpoint
ALTER TABLE "category" ADD CONSTRAINT "category_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule" ADD CONSTRAINT "rule_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule" ADD CONSTRAINT "rule_user_id_category_id_category_user_id_id_fk" FOREIGN KEY ("user_id","category_id") REFERENCES "public"."category"("user_id","id") ON DELETE cascade ON UPDATE no action;