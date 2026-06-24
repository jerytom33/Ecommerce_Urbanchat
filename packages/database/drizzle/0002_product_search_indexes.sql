-- Migration: Add GIN indexes for full-text search on products
-- Supports full-text search across product title, description, and tags (metadata)
-- Relevance ranking: title (weight A) > description (weight B)

-- GIN index on combined tsvector of title and description with weights
CREATE INDEX IF NOT EXISTS products_search_idx 
ON products 
USING GIN (
  (
    setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(description, '')), 'B')
  )
);

-- Index for autocomplete prefix matching on title
CREATE INDEX IF NOT EXISTS products_title_trgm_idx 
ON products 
USING GIN (title gin_trgm_ops);

-- Partial index for active products only (used in storefront queries)
CREATE INDEX IF NOT EXISTS products_active_tenant_idx 
ON products (tenant_id) 
WHERE status = 'active';
