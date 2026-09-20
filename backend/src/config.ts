import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  PORT: z.coerce
    .number()
    .int()
    .positive()
    .default(3000),

  APP_BASE_URL: z.string().url(),

  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  DATABASE_URL: z.string().min(1),

  ENCRYPTION_KEY: z
    .string()
    .regex(
      /^[0-9a-fA-F]{64}$/,
      "ENCRYPTION_KEY must be exactly 64 hexadecimal characters."
    ),

  SHOPIFY_API_KEY: z.string().optional(),

  SHOPIFY_API_SECRET: z.string().optional(),

  SHOPIFY_APP_URL: z
    .string()
    .url()
    .optional(),

  SHOPIFY_WEBHOOK_SECRET: z
    .string()
    .optional(),

  SHOPIFY_SCOPES: z
    .string()
    .default(
      "read_orders,read_products,read_inventory,read_locations"
    ),

  QBO_CLIENT_ID: z.string().optional(),

  QBO_CLIENT_SECRET: z.string().optional(),

  QBO_ENVIRONMENT: z
    .enum(["sandbox", "production"])
    .default("sandbox"),

  QBO_REDIRECT_URI: z
    .string()
    .url()
    .optional(),

  QBO_RECONNECT_URL: z
    .string()
    .url()
    .optional(),

  COGS_METHOD: z
    .enum(["weighted_average", "fifo"])
    .default("weighted_average"),
});

export type Env = z.infer<typeof EnvSchema>;

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;