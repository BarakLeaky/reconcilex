CREATE TABLE IF NOT EXISTS merchants (
    id BIGSERIAL PRIMARY KEY,

    shopify_shop_domain TEXT UNIQUE NOT NULL,

    shopify_access_token TEXT,

    qbo_realm_id TEXT,
    qbo_access_token TEXT,
    qbo_refresh_token TEXT,
    qbo_token_expires_at TIMESTAMPTZ,

    qbo_cogs_account_id TEXT,
    qbo_inventory_asset_account_id TEXT,

    cogs_method TEXT NOT NULL DEFAULT 'weighted_average'
        CHECK (cogs_method IN ('weighted_average', 'fifo')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS oauth_states (
    id BIGSERIAL PRIMARY KEY,

    state TEXT UNIQUE NOT NULL,

    shop TEXT NOT NULL,

    purpose TEXT NOT NULL,

    expires_at TIMESTAMPTZ NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sku_costs (
    id BIGSERIAL PRIMARY KEY,

    merchant_id BIGINT NOT NULL
        REFERENCES merchants(id)
        ON DELETE CASCADE,

    sku TEXT NOT NULL,

    variant_id TEXT NOT NULL,

    supplier_cost NUMERIC(14, 4) NOT NULL DEFAULT 0,

    freight_cost NUMERIC(14, 4) NOT NULL DEFAULT 0,

    duty_cost NUMERIC(14, 4) NOT NULL DEFAULT 0,

    other_cost NUMERIC(14, 4) NOT NULL DEFAULT 0,

    landed_cost NUMERIC(14, 4)
        GENERATED ALWAYS AS (
            supplier_cost
            + freight_cost
            + duty_cost
            + other_cost
        ) STORED,

    effective_date DATE NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (
        merchant_id,
        variant_id,
        effective_date
    )
);

CREATE TABLE IF NOT EXISTS order_line_costs (
    id BIGSERIAL PRIMARY KEY,

    merchant_id BIGINT NOT NULL
        REFERENCES merchants(id)
        ON DELETE CASCADE,

    shopify_order_id TEXT NOT NULL,

    shopify_line_item_id TEXT NOT NULL,

    sku TEXT NOT NULL,

    quantity INTEGER NOT NULL
        CHECK (quantity > 0),

    unit_landed_cost NUMERIC(14, 4) NOT NULL,

    total_cogs NUMERIC(14, 4) NOT NULL,

    qbo_journal_entry_id TEXT,

    sync_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (
            sync_status IN (
                'pending',
                'processing',
                'synced',
                'failed'
            )
        ),

    sync_error TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (
        merchant_id,
        shopify_line_item_id
    )
);

CREATE TABLE IF NOT EXISTS sync_jobs (
    id BIGSERIAL PRIMARY KEY,

    merchant_id BIGINT NOT NULL
        REFERENCES merchants(id)
        ON DELETE CASCADE,

    job_type TEXT NOT NULL,

    payload JSONB NOT NULL,

    status TEXT NOT NULL DEFAULT 'queued'
        CHECK (
            status IN (
                'queued',
                'processing',
                'completed',
                'failed',
                'dead_letter'
            )
        ),

    attempts INTEGER NOT NULL DEFAULT 0,

    max_attempts INTEGER NOT NULL DEFAULT 5,

    last_error TEXT,

    run_after TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_jobs_processing
    ON sync_jobs(status, run_after);

CREATE INDEX IF NOT EXISTS idx_sku_costs_lookup
    ON sku_costs(merchant_id, sku, effective_date DESC);

CREATE INDEX IF NOT EXISTS idx_order_line_costs_order
    ON order_line_costs(merchant_id, shopify_order_id);

CREATE INDEX IF NOT EXISTS idx_order_line_costs_sync
    ON order_line_costs(sync_status);