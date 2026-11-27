-- Revoke PostgreSQL's database-global built-in PUBLIC EXECUTE default on functions created by
-- the migration owner (postgres), complementing the public-schema default privilege lock.

DO $$
DECLARE
  migration_owner TEXT := current_user;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
    migration_owner := 'postgres';
  END IF;

  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC', migration_owner);

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I REVOKE ALL ON FUNCTIONS FROM "anon"', migration_owner);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I REVOKE ALL ON FUNCTIONS FROM "authenticated"', migration_owner);
  END IF;
END $$;
