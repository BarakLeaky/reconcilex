import crypto from "node:crypto";
import { Router, Request, Response } from "express";

import { env } from "../config";
import { pool } from "../db/pool";

const router = Router();

const SHOPIFY_API_VERSION = "2026-07";

const SHOPIFY_SCOPES =
  "read_orders,read_products,read_inventory,read_locations";

function normalizeShopDomain(shop: string): string {
  return shop
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
}

function isValidShopDomain(shop: string): boolean {
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop);
}

function getShopifyCallbackUrl(): string {
  const baseUrl = (
    env.SHOPIFY_APP_URL ||
    env.APP_BASE_URL ||
    ""
  ).replace(/\/+$/, "");

  if (!baseUrl) {
    throw new Error(
      "SHOPIFY_APP_URL or APP_BASE_URL is not configured"
    );
  }

  return `${baseUrl}/api/shopify/callback`;
}

async function getMerchant(shop: string) {
  const result = await pool.query(
    `
    SELECT
      id,
      shopify_shop_domain,
      shopify_access_token,
      cogs_method
    FROM merchants
    WHERE shopify_shop_domain = $1
    LIMIT 1
    `,
    [shop]
  );

  return result.rows[0] || null;
}

async function shopifyGraphQL<T>(
  shop: string,
  accessToken: string,
  query: string,
  variables: Record<string, unknown> = {}
): Promise<T> {
  const url =
    `https://${shop}/admin/api/` +
    `${SHOPIFY_API_VERSION}/graphql.json`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  const responseText = await response.text();

  if (!response.ok) {
    console.error(
      "Shopify GraphQL HTTP error:",
      response.status,
      responseText
    );

    throw new Error(
      `Shopify API returned HTTP ${response.status}`
    );
  }

  let data: {
    data?: T;
    errors?: Array<{
      message?: string;
    }>;
  };

  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error("Shopify returned invalid JSON");
  }

  if (data.errors && data.errors.length > 0) {
    console.error(
      "Shopify GraphQL errors:",
      data.errors
    );

    throw new Error(
      data.errors
        .map(
          (error) =>
            error.message || "Unknown Shopify error"
        )
        .join("; ")
    );
  }

  if (!data.data) {
    throw new Error(
      "Shopify returned no GraphQL data"
    );
  }

  return data.data;
}

/* ============================================================
   SHOPIFY INSTALL
   ============================================================ */

router.get(
  "/install",
  async (req: Request, res: Response) => {
    try {
      if (
        !env.SHOPIFY_API_KEY ||
        !env.SHOPIFY_API_SECRET
      ) {
        return res.status(500).json({
          error:
            "Shopify API credentials are not configured",
        });
      }

      const shop = normalizeShopDomain(
        String(req.query.shop || "")
      );

      if (!isValidShopDomain(shop)) {
        return res.status(400).json({
          error: "Invalid Shopify shop domain",
        });
      }

      const state = crypto
        .randomBytes(32)
        .toString("hex");

      const expiresAt = new Date(
        Date.now() + 10 * 60 * 1000
      );

      await pool.query(
        `
        INSERT INTO oauth_states (
          state,
          shop,
          purpose,
          expires_at
        )
        VALUES ($1, $2, $3, $4)
        `,
        [
          state,
          shop,
          "shopify_install",
          expiresAt,
        ]
      );

      const redirectUri =
        getShopifyCallbackUrl();

      const authorizationUrl =
        `https://${shop}/admin/oauth/authorize` +
        `?client_id=${encodeURIComponent(
          env.SHOPIFY_API_KEY
        )}` +
        `&scope=${encodeURIComponent(
          SHOPIFY_SCOPES
        )}` +
        `&redirect_uri=${encodeURIComponent(
          redirectUri
        )}` +
        `&state=${encodeURIComponent(state)}`;

      console.log(
        "Shopify OAuth authorization URL:",
        authorizationUrl
      );

      console.log(
        "Shopify OAuth callback:",
        redirectUri
      );

      return res.redirect(
        authorizationUrl
      );
    } catch (error) {
      console.error(
        "Shopify install failed:",
        error
      );

      return res.status(500).json({
        error: "Internal server error",
      });
    }
  }
);

/* ============================================================
   SHOPIFY CALLBACK
   ============================================================ */

router.get(
  "/callback",
  async (req: Request, res: Response) => {
    try {
      if (
        !env.SHOPIFY_API_KEY ||
        !env.SHOPIFY_API_SECRET
      ) {
        return res.status(500).json({
          error:
            "Shopify API credentials are not configured",
        });
      }

      const shop = normalizeShopDomain(
        String(req.query.shop || "")
      );

      const code = String(
        req.query.code || ""
      );

      const state = String(
        req.query.state || ""
      );

      if (!isValidShopDomain(shop)) {
        return res.status(400).json({
          error: "Invalid Shopify shop domain",
        });
      }

      if (!code || !state) {
        return res.status(400).json({
          error:
            "Missing OAuth code or state",
        });
      }

      const stateResult =
        await pool.query(
          `
          SELECT
            id,
            shop,
            purpose,
            expires_at
          FROM oauth_states
          WHERE state = $1
          LIMIT 1
          `,
          [state]
        );

      if (
        stateResult.rows.length === 0
      ) {
        return res.status(400).json({
          error: "Invalid OAuth state",
        });
      }

      const oauthState =
        stateResult.rows[0];

      if (
        oauthState.purpose !==
        "shopify_install"
      ) {
        return res.status(400).json({
          error:
            "Invalid OAuth state purpose",
        });
      }

      if (
        oauthState.shop !== shop
      ) {
        return res.status(400).json({
          error: "OAuth shop mismatch",
        });
      }

      if (
        new Date(
          oauthState.expires_at
        ).getTime() < Date.now()
      ) {
        await pool.query(
          `
          DELETE FROM oauth_states
          WHERE id = $1
          `,
          [oauthState.id]
        );

        return res.status(400).json({
          error: "OAuth state expired",
        });
      }

      const tokenUrl =
        `https://${shop}/admin/oauth/access_token`;

      const tokenResponse =
        await fetch(tokenUrl, {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            client_id:
              env.SHOPIFY_API_KEY,

            client_secret:
              env.SHOPIFY_API_SECRET,

            code,
          }),
        });

      if (!tokenResponse.ok) {
        const responseText =
          await tokenResponse.text();

        console.error(
          "Shopify token exchange failed:",
          tokenResponse.status,
          responseText
        );

        return res.status(502).json({
          error:
            "Shopify token exchange failed",
        });
      }

      const tokenData =
        (await tokenResponse.json()) as {
          access_token?: string;
          scope?: string;
        };

      if (
        !tokenData.access_token
      ) {
        return res.status(502).json({
          error:
            "Shopify did not return an access token",
        });
      }

      await pool.query(
        `
        INSERT INTO merchants (
          shopify_shop_domain,
          shopify_access_token
        )
        VALUES ($1, $2)
        ON CONFLICT (shopify_shop_domain)
        DO UPDATE SET
          shopify_access_token =
            EXCLUDED.shopify_access_token,
          updated_at = NOW()
        `,
        [
          shop,
          tokenData.access_token,
        ]
      );

      await pool.query(
        `
        DELETE FROM oauth_states
        WHERE id = $1
        `,
        [oauthState.id]
      );

      console.log(
        "Shopify store connected successfully:",
        shop
      );

      return res.json({
        status: "connected",
        shop,
        scope:
          tokenData.scope || null,
      });
    } catch (error) {
      console.error(
        "Shopify OAuth callback failed:",
        error
      );

      return res.status(500).json({
        error: "Internal server error",
      });
    }
  }
);

/* ============================================================
   SHOPIFY CONNECTION STATUS
   ============================================================ */

router.get(
  "/status/:shop",
  async (req: Request, res: Response) => {
    try {
      const shop = normalizeShopDomain(
        String(req.params.shop)
      );

      if (!isValidShopDomain(shop)) {
        return res.status(400).json({
          error: "Invalid Shopify shop domain",
        });
      }

      const merchant =
        await getMerchant(shop);

      if (!merchant) {
        return res.status(404).json({
          connected: false,
          shop,
          error:
            "Shopify store not connected",
        });
      }

      return res.json({
        connected:
          Boolean(
            merchant.shopify_access_token
          ),
        shop,
        merchant_id: merchant.id,
        cogs_method:
          merchant.cogs_method,
      });
    } catch (error) {
      console.error(
        "Shopify status check failed:",
        error
      );

      return res.status(500).json({
        error: "Internal server error",
      });
    }
  }
);

/* ============================================================
   SHOPIFY PRODUCTS
   ============================================================ */

router.get(
  "/products/:shop",
  async (req: Request, res: Response) => {
    try {
      const shop = normalizeShopDomain(
        String(req.params.shop)
      );

      if (!isValidShopDomain(shop)) {
        return res.status(400).json({
          error: "Invalid Shopify shop domain",
        });
      }

      const merchant =
        await getMerchant(shop);

      if (
        !merchant ||
        !merchant.shopify_access_token
      ) {
        return res.status(404).json({
          error:
            "Shopify store is not connected",
        });
      }

      const data =
        await shopifyGraphQL<{
          products: {
            nodes: Array<{
              id: string;
              title: string;
              status: string;
              variants: {
                nodes: Array<{
                  id: string;
                  sku: string | null;
                  title: string;
                  inventoryQuantity:
                    number | null;
                }>;
              };
            }>;
            pageInfo: {
              hasNextPage: boolean;
              endCursor: string | null;
            };
          };
        }>(
          shop,
          merchant.shopify_access_token,
          `
          query GetProducts {
            products(first: 100) {
              nodes {
                id
                title
                status
                variants(first: 100) {
                  nodes {
                    id
                    sku
                    title
                    inventoryQuantity
                  }
                }
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
          `
        );

      return res.json({
        shop,
        products:
          data.products.nodes,
        page_info:
          data.products.pageInfo,
      });
    } catch (error) {
      console.error(
        "Shopify products request failed:",
        error
      );

      return res.status(502).json({
        error:
          error instanceof Error
            ? error.message
            : "Shopify products request failed",
      });
    }
  }
);

/* ============================================================
   SHOPIFY ORDERS
   ============================================================ */

router.get(
  "/orders/:shop",
  async (req: Request, res: Response) => {
    try {
      const shop = normalizeShopDomain(
        String(req.params.shop)
      );

      if (!isValidShopDomain(shop)) {
        return res.status(400).json({
          error: "Invalid Shopify shop domain",
        });
      }

      const merchant =
        await getMerchant(shop);

      if (
        !merchant ||
        !merchant.shopify_access_token
      ) {
        return res.status(404).json({
          error:
            "Shopify store is not connected",
        });
      }

      const data =
        await shopifyGraphQL<{
          orders: {
            nodes: Array<{
              id: string;
              name: string;
              createdAt: string;
              displayFinancialStatus:
                string | null;
              displayFulfillmentStatus:
                string | null;
              lineItems: {
                nodes: Array<{
                  id: string;
                  title: string;
                  quantity: number;
                  sku: string | null;
                  variant: {
                    id: string;
                    sku: string | null;
                  } | null;
                }>;
              };
            }>;
            pageInfo: {
              hasNextPage: boolean;
              endCursor: string | null;
            };
          };
        }>(
          shop,
          merchant.shopify_access_token,
          `
          query GetOrders {
            orders(
              first: 50,
              sortKey: CREATED_AT,
              reverse: true
            ) {
              nodes {
                id
                name
                createdAt
                displayFinancialStatus
                displayFulfillmentStatus
                lineItems(first: 100) {
                  nodes {
                    id
                    title
                    quantity
                    sku
                    variant {
                      id
                      sku
                    }
                  }
                }
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
          `
        );

      return res.json({
        shop,
        orders:
          data.orders.nodes,
        page_info:
          data.orders.pageInfo,
      });
    } catch (error) {
      console.error(
        "Shopify orders request failed:",
        error
      );

      return res.status(502).json({
        error:
          error instanceof Error
            ? error.message
            : "Shopify orders request failed",
      });
    }
  }
);

/* ============================================================
   SHOPIFY INVENTORY
   ============================================================ */

router.get(
  "/inventory/:shop",
  async (req: Request, res: Response) => {
    try {
      const shop = normalizeShopDomain(
        String(req.params.shop)
      );

      if (!isValidShopDomain(shop)) {
        return res.status(400).json({
          error: "Invalid Shopify shop domain",
        });
      }

      const merchant =
        await getMerchant(shop);

      if (
        !merchant ||
        !merchant.shopify_access_token
      ) {
        return res.status(404).json({
          error:
            "Shopify store is not connected",
        });
      }

      const data =
        await shopifyGraphQL<{
          locations: {
            nodes: Array<{
              id: string;
              name: string;
              inventoryLevels: {
                nodes: Array<{
                  quantities: Array<{
                    name: string;
                    quantity: number;
                  }>;
                  item: {
                    id: string;
                    sku: string | null;
                  } | null;
                }>;
              };
            }>;
          };
        }>(
          shop,
          merchant.shopify_access_token,
          `
          query GetInventory {
            locations(first: 100) {
              nodes {
                id
                name
                inventoryLevels(first: 250) {
                  nodes {
                    quantities(names: ["available"]) {
                      name
                      quantity
                    }
                    item {
                      id
                      sku
                    }
                  }
                }
              }
            }
          }
          `
        );

      return res.json({
        shop,
        locations:
          data.locations.nodes,
      });
    } catch (error) {
      console.error(
        "Shopify inventory request failed:",
        error
      );

      return res.status(502).json({
        error:
          error instanceof Error
            ? error.message
            : "Shopify inventory request failed",
      });
    }
  }
);

export default router;