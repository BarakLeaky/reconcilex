import { Router, Request, Response } from "express";

import { pool } from "../db/pool";

const router = Router();

/**
 * Create a SKU cost record
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const {
      merchant_id,
      sku,
      variant_id,
      supplier_cost = 0,
      freight_cost = 0,
      duty_cost = 0,
      other_cost = 0,
      effective_date,
    } = req.body;

    if (!merchant_id) {
      return res.status(400).json({
        error: "merchant_id is required",
      });
    }

    if (!sku) {
      return res.status(400).json({
        error: "sku is required",
      });
    }

    if (!variant_id) {
      return res.status(400).json({
        error: "variant_id is required",
      });
    }

    if (!effective_date) {
      return res.status(400).json({
        error: "effective_date is required",
      });
    }

    const costs = [
      supplier_cost,
      freight_cost,
      duty_cost,
      other_cost,
    ];

    if (costs.some((value) => Number.isNaN(Number(value)) || Number(value) < 0)) {
      return res.status(400).json({
        error: "Costs must be valid non-negative numbers",
      });
    }

    const merchantResult = await pool.query(
      `
      SELECT id
      FROM merchants
      WHERE id = $1
      `,
      [merchant_id]
    );

    if (merchantResult.rows.length === 0) {
      return res.status(404).json({
        error: "Merchant not found",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO sku_costs (
        merchant_id,
        sku,
        variant_id,
        supplier_cost,
        freight_cost,
        duty_cost,
        other_cost,
        effective_date
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING
        id,
        merchant_id,
        sku,
        variant_id,
        supplier_cost,
        freight_cost,
        duty_cost,
        other_cost,
        landed_cost,
        effective_date,
        created_at
      `,
      [
        merchant_id,
        sku,
        variant_id,
        supplier_cost,
        freight_cost,
        duty_cost,
        other_cost,
        effective_date,
      ]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error: any) {
    if (error.code === "23505") {
      return res.status(409).json({
        error:
          "A cost record already exists for this merchant, variant, and effective date",
      });
    }

    console.error("Create SKU cost failed:", error);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
});

/**
 * List SKU costs for a merchant
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const { merchant_id, sku, variant_id } = req.query;

    if (!merchant_id) {
      return res.status(400).json({
        error: "merchant_id is required",
      });
    }

    const values: unknown[] = [merchant_id];

    let query = `
      SELECT
        id,
        merchant_id,
        sku,
        variant_id,
        supplier_cost,
        freight_cost,
        duty_cost,
        other_cost,
        landed_cost,
        effective_date,
        created_at
      FROM sku_costs
      WHERE merchant_id = $1
    `;

    if (sku) {
      values.push(sku);
      query += ` AND sku = $${values.length}`;
    }

    if (variant_id) {
      values.push(variant_id);
      query += ` AND variant_id = $${values.length}`;
    }

    query += `
      ORDER BY effective_date DESC, created_at DESC
    `;

    const result = await pool.query(query, values);

    return res.json(result.rows);
  } catch (error) {
    console.error("List SKU costs failed:", error);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
});

/**
 * Get the latest effective cost for a SKU variant
 */
router.get("/latest", async (req: Request, res: Response) => {
  try {
    const { merchant_id, sku, variant_id } = req.query;

    if (!merchant_id || !sku || !variant_id) {
      return res.status(400).json({
        error: "merchant_id, sku, and variant_id are required",
      });
    }

    const result = await pool.query(
      `
      SELECT
        id,
        merchant_id,
        sku,
        variant_id,
        supplier_cost,
        freight_cost,
        duty_cost,
        other_cost,
        landed_cost,
        effective_date,
        created_at
      FROM sku_costs
      WHERE merchant_id = $1
        AND sku = $2
        AND variant_id = $3
        AND effective_date <= CURRENT_DATE
      ORDER BY effective_date DESC
      LIMIT 1
      `,
      [merchant_id, sku, variant_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "No effective SKU cost found",
      });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error("Get latest SKU cost failed:", error);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
});

/**
 * Delete a SKU cost record
 */
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      DELETE FROM sku_costs
      WHERE id = $1
      RETURNING id
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "SKU cost not found",
      });
    }

    return res.status(204).send();
  } catch (error) {
    console.error("Delete SKU cost failed:", error);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
});

export default router;