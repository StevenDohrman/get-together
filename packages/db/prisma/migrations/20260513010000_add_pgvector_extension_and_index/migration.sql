-- Add pgvector extension and create IVFFlat index for similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Alter the vector column type from JSON to pgvector
ALTER TABLE "InterestEmbedding"
ALTER COLUMN vector TYPE vector(768) USING vector::text::vector(768);

-- Create IVFFlat index for efficient cosine similarity search
CREATE INDEX IF NOT EXISTS idx_interestembedding_vector ON "InterestEmbedding" 
USING ivfflat (vector vector_cosine_ops) WITH (lists = 100);
