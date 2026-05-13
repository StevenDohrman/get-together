-- Migration: add interest DAG relations and embeddings

BEGIN;

-- Add metadata and is_root to existing interest table
ALTER TABLE "Interest"
  ADD COLUMN IF NOT EXISTS metadata jsonb,
  ADD COLUMN IF NOT EXISTS is_root boolean DEFAULT false;

-- Create interest_relation join table for DAG edges
CREATE TABLE IF NOT EXISTS "InterestRelation" (
  parent_id uuid NOT NULL,
  child_id uuid NOT NULL,
  weight smallint,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (parent_id, child_id),
  CONSTRAINT fk_parent_interest FOREIGN KEY (parent_id) REFERENCES "Interest"(id) ON DELETE CASCADE,
  CONSTRAINT fk_child_interest FOREIGN KEY (child_id) REFERENCES "Interest"(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_interestrelation_child ON "InterestRelation"(child_id);

-- Create interest_embedding table
CREATE TABLE IF NOT EXISTS "InterestEmbedding" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interest_id uuid UNIQUE NOT NULL,
  vector jsonb NOT NULL,
  model text NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT fk_embedding_interest FOREIGN KEY (interest_id) REFERENCES "Interest"(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_interestembedding_interest ON "InterestEmbedding"(interest_id);

COMMIT;
