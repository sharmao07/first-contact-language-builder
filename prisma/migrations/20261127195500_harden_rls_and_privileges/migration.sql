-- Non-destructive security hardening for PostgreSQL / Supabase Data API defense-in-depth.
-- Enables Row Level Security on all public application tables without public/anon/authenticated policies,
-- revokes direct table/sequence/function privileges from client roles, and locks future objects created
-- by the migration owner (postgres) in the public schema.

ALTER TABLE "public"."DiscoverySession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Participant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Evidence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Concept" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."VocabularyEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ConceptHypothesis" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ConceptRelationship" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."VerificationExperiment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."VerificationResponse" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."LearningActivity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ActivityResponse" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ResearchNote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."SessionEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Expression" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ExpressionConcept" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."CommunicationTask" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."IndependentResponse" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ExperimentProposal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."AccessCredential" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."RateLimitBucket" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = '_prisma_migrations') THEN
    EXECUTE 'ALTER TABLE "public"."_prisma_migrations" ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

REVOKE CREATE ON SCHEMA "public" FROM PUBLIC;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA "public" FROM PUBLIC;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA "public" FROM PUBLIC;
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA "public" FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE CREATE ON SCHEMA "public" FROM "anon"';
    EXECUTE 'REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA "public" FROM "anon"';
    EXECUTE 'REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA "public" FROM "anon"';
    EXECUTE 'REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA "public" FROM "anon"';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE CREATE ON SCHEMA "public" FROM "authenticated"';
    EXECUTE 'REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA "public" FROM "authenticated"';
    EXECUTE 'REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA "public" FROM "authenticated"';
    EXECUTE 'REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA "public" FROM "authenticated"';
  END IF;
END $$;

ALTER DEFAULT PRIVILEGES IN SCHEMA "public" REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA "public" REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA "public" REVOKE ALL ON FUNCTIONS FROM PUBLIC;

DO $$
DECLARE
  migration_owner TEXT := current_user;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
    migration_owner := 'postgres';
  END IF;

  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA "public" REVOKE ALL ON TABLES FROM PUBLIC', migration_owner);
  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA "public" REVOKE ALL ON SEQUENCES FROM PUBLIC', migration_owner);
  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA "public" REVOKE ALL ON FUNCTIONS FROM PUBLIC', migration_owner);

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA "public" REVOKE ALL ON TABLES FROM "anon"', migration_owner);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA "public" REVOKE ALL ON SEQUENCES FROM "anon"', migration_owner);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA "public" REVOKE ALL ON FUNCTIONS FROM "anon"', migration_owner);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA "public" REVOKE ALL ON TABLES FROM "authenticated"', migration_owner);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA "public" REVOKE ALL ON SEQUENCES FROM "authenticated"', migration_owner);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA "public" REVOKE ALL ON FUNCTIONS FROM "authenticated"', migration_owner);
  END IF;
END $$;
