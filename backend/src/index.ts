import express from "express";

import { env } from "./config";
import { pool } from "./db/pool";
import merchantRoutes from "./routes/merchants";
import skuCostRoutes from "./routes/skuCosts";
import shopifyRoutes from "./routes/shopify";

const app = express();

app.use(express.json());

app.get(
  "/health",
  async (_req, res) => {
    try {
      await pool.query(
        "SELECT 1"
      );

      res.json({
        status: "ok",
        database: "connected",
      });
    } catch (error) {
      console.error(
        "Database health check failed:",
        error
      );

      res.status(503).json({
        status: "error",
        database: "disconnected",
      });
    }
  }
);

app.get(
  "/",
  (_req, res) => {
    res.json({
      name: "ReconcileX Backend",
      status: "running",
    });
  }
);

app.use(
  "/api/merchants",
  merchantRoutes
);

app.use(
  "/api/sku-costs",
  skuCostRoutes
);

app.use(
  "/api/shopify",
  shopifyRoutes
);

app.listen(
  env.PORT,
  () => {
    console.log(
      `ReconcileX backend running on port ${env.PORT}`
    );
  }
);