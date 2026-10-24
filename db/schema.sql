-- ============================================================================
-- QUICK-ECOMERCE CANONICAL TRANSACTIONAL SCHEMA (POSTGRESQL 16+)
-- Multi-Tenant Partitioning, Double-Entry Inventory Ledger & Transactional Outbox
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Tenants Table (Multi-Tenant Partition Key)
CREATE TABLE IF NOT EXISTS tenants (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(128) NOT NULL UNIQUE,
    currency VARCHAR(3) NOT NULL DEFAULT 'SAR',
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);

-- 2. Products Master Table
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(64) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    title_ar VARCHAR(255) NOT NULL,
    title_en VARCHAR(255),
    sku VARCHAR(128) NOT NULL,
    barcode VARCHAR(64),
    price_halalas BIGINT NOT NULL,          -- Integer currency representation (1 SAR = 100 Halalas)
    cost_price_halalas BIGINT,
    tax_rate_percent NUMERIC(5, 2) NOT NULL DEFAULT 15.00, -- Standard Saudi VAT
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, id),
    CONSTRAINT uk_products_sku UNIQUE (tenant_id, sku)
);
CREATE INDEX IF NOT EXISTS idx_products_lookup ON products(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_products_attributes_gin ON products USING GIN(attributes);

-- 3. Append-Only Inventory Ledger
DO $$ BEGIN
    CREATE TYPE inventory_movement_type AS ENUM (
        'INITIAL_STOCK',
        'RESERVATION_HOLD',
        'RESERVATION_RELEASE',
        'ORDER_FULFILLMENT',
        'CUSTOMER_RETURN',
        'MERCHANT_ADJUSTMENT',
        'DAMAGE_WRITEOFF'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS inventory_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    sku VARCHAR(128) NOT NULL,
    movement_type inventory_movement_type NOT NULL,
    quantity_delta INTEGER NOT NULL,        -- Positive for addition, negative for decrement
    balance_after INTEGER NOT NULL,         -- Running balance verification
    reference_type VARCHAR(64) NOT NULL,    -- 'ORDER', 'RESERVATION', 'TRANSFER', 'MANUAL'
    reference_id VARCHAR(128) NOT NULL,     -- Order UUID or Reservation Token
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_inventory_product FOREIGN KEY (tenant_id, sku) REFERENCES products(tenant_id, sku)
);
CREATE INDEX IF NOT EXISTS idx_inv_ledger_sku ON inventory_ledger(tenant_id, sku, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inv_ledger_ref ON inventory_ledger(reference_type, reference_id);

-- 4. Orders Master Table
DO $$ BEGIN
    CREATE TYPE order_status AS ENUM (
        'PENDING_PAYMENT',
        'PAID',
        'PROCESSING',
        'DISPATCHED',
        'DELIVERED',
        'CANCELLED',
        'REFUNDED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    order_number VARCHAR(64) NOT NULL,      -- Human-readable sequence: ORD-2026-XXXX
    customer_id VARCHAR(64) NOT NULL,
    customer_phone VARCHAR(32) NOT NULL,
    customer_email VARCHAR(255),
    status order_status NOT NULL DEFAULT 'PENDING_PAYMENT',
    currency VARCHAR(3) NOT NULL DEFAULT 'SAR',
    
    subtotal_halalas BIGINT NOT NULL,
    tax_total_halalas BIGINT NOT NULL,
    shipping_total_halalas BIGINT NOT NULL,
    discount_total_halalas BIGINT NOT NULL DEFAULT 0,
    grand_total_halalas BIGINT NOT NULL,
    
    shipping_address JSONB NOT NULL,
    billing_address JSONB NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_orders_tenant_number UNIQUE (tenant_id, order_number),
    CONSTRAINT uk_orders_idempotency UNIQUE (tenant_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_status ON orders(tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(tenant_id, customer_phone);

-- 5. Order Line Items Table
CREATE TABLE IF NOT EXISTS order_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    sku VARCHAR(128) NOT NULL,
    product_title VARCHAR(255) NOT NULL,
    unit_price_halalas BIGINT NOT NULL,
    tax_rate_percent NUMERIC(5, 2) NOT NULL,
    tax_amount_halalas BIGINT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    total_halalas BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_line_items_order ON order_line_items(order_id);

-- 6. Transactional Outbox Events Table (For Debezium CDC / Kafka)
CREATE TABLE IF NOT EXISTS outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    aggregate_type VARCHAR(64) NOT NULL,    -- 'Order', 'Inventory', 'Payment'
    aggregate_id VARCHAR(128) NOT NULL,     -- Order ID / SKU
    event_type VARCHAR(64) NOT NULL,        -- 'OrderPlaced', 'InventoryCommitted', 'InvoiceRequested'
    payload JSONB NOT NULL,
    trace_parent VARCHAR(128),              -- OpenTelemetry W3C distributed trace context
    is_processed BOOLEAN NOT NULL DEFAULT FALSE,
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_outbox_unprocessed ON outbox_events(created_at) WHERE is_processed = FALSE;
