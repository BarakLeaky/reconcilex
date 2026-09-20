import { Router, Request, Response } from "express";

import { pool } from "../db/pool";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  try {
    const {
      shopify_shop_domain,
      cogs_method = "weighted_average",
    } = req.body;

    if (!shopify_shop_domain) {
      return res.status(400).json({
        error: "shopify_shop_domain is required",
      });
    }

    if (!["weighted_average", "fifo"].includes(cogs_method)) {
      return res.status(400).json({
        error: "Invalid cogs_method",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO merchants (
        shopify_shop_domain,
        cogs_method
      )
      VALUES ($1, $2)
      RETURNING
        id,
        shopify_shop_domain,
        cogs_method,
        created_at,
        updated_at
      `,
      [shopify_shop_domain, cogs_method]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error: any) {
    if (error.code === "23505") {
      return res.status(409).json({
        error: "Merchant already exists",
      });
    }

    console.error("Create merchant failed:", error);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
});

router.get("/", async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `
      SELECT
        id,
        shopify_shop_domain,
        qbo_realm_id,
        qbo_cogs_account_id,
        qbo_inventory_asset_account_id,
        cogs_method,
        created_at,
        updated_at
      FROM merchants
      ORDER BY created_at DESC
      `
    );

    return res.json(result.rows);
  } catch (error) {
    console.error("List merchants failed:", error);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
        id,
        shopify_shop_domain,
        qbo_realm_id,
        qbo_cogs_account_id,
        qbo_inventory_asset_account_id,
        cogs_method,
        created_at,
        updated_at
      FROM merchants
      WHERE id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Merchant not found",
      });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error("Get merchant failed:", error);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
});

router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      shopify_shop_domain,
      cogs_method,
      qbo_cogs_account_id,
      qbo_inventory_asset_account_id,
    } = req.body;

    if (
      cogs_method !== undefined &&
      !["weighted_average", "fifo"].includes(cogs_method)
    ) {
      return res.status(400).json({
        error: "Invalid cogs_method",
      });
    }

    const result = await pool.query(
      `
      UPDATE merchants
      SET
        shopify_shop_domain = COALESCE($1, shopify_shop_domain),
        cogs_method = COALESCE($2, cogs_method),
        qbo_cogs_account_id = COALESCE($3, qbo_cogs_account_id),
        qbo_inventory_asset_account_id = COALESCE(
          $4,
          qbo_inventory_asset_account_id
        ),
        updated_at = NOW()
      WHERE id = $5
      RETURNING
        id,
        shopify_shop_domain,
        qbo_realm_id,
        qbo_cogs_account_id,
        qbo_inventory_asset_account_id,
        cogs_method,
        created_at,
        updated_at
      `,
      [
        shopify_shop_domain ?? null,
        cogs_method ?? null,
        qbo_cogs_account_id ?? null,
        qbo_inventory_asset_account_id ?? null,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Merchant not found",
      });
    }

    return res.json(result.rows[0]);
  } catch (error: any) {
    if (error.code === "23505") {
      return res.status(409).json({
        error: "Shopify shop domain already exists",
      });
    }

    console.error("Update merchant failed:", error);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      DELETE FROM merchants
      WHERE id = $1
      RETURNING id
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Merchant not found",
      });
    }

    return res.status(204).send();
  } catch (error) {
    console.error("Delete merchant failed:", error);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
});

export default router;