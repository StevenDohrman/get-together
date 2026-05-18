-- Enable PostGIS extension and create UserLocation table with geography(Point,4326)
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS "UserLocation" (
  "userId" uuid PRIMARY KEY,
  -- use fully-qualified PostGIS geography type in public schema to avoid Prisma's extension schema ambiguity
  "location" public.geography(Point, 4326),
  "friendlyName" text,
  "updatedAt" timestamptz DEFAULT now(),
  CONSTRAINT "UserLocation_user_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "UserLocation_userId_idx" ON "UserLocation" ("userId");
