CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refresh_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "categories" ALTER COLUMN "path" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "status" varchar(20) DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "categories_tenant_id_idx" ON "categories" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "listings_tenant_id_idx" ON "listings" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "listings_product_id_idx" ON "listings" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "media_product_id_idx" ON "media" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "media_tenant_id_idx" ON "media" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "products_tenant_id_idx" ON "products" USING btree ("tenant_id");--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_tenant_id_sku_unique" UNIQUE("tenant_id","sku");--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_depth_check" CHECK ("categories"."depth" >= 0 AND "categories"."depth" <= 4);--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_price_check" CHECK ("listings"."price" >= 0.01 AND "listings"."price" <= 999999999.99);--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_weight_check" CHECK ("listings"."weight" IS NULL OR ("listings"."weight" >= 0 AND "listings"."weight" <= 1000000));--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_inventory_quantity_check" CHECK ("listings"."inventory_quantity" >= 0 AND "listings"."inventory_quantity" <= 999999);--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_title_length_check" CHECK (length("products"."title") >= 1 AND length("products"."title") <= 255);--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_description_length_check" CHECK ("products"."description" IS NULL OR length("products"."description") <= 10000);