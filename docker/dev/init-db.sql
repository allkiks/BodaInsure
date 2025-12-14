-- BodaInsure Development Database Initialization
-- This script runs automatically when the PostgreSQL container is first created

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create additional schemas if needed
-- CREATE SCHEMA IF NOT EXISTS audit;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE bodainsure TO bodainsure;

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE 'BodaInsure development database initialized successfully';
END $$;
