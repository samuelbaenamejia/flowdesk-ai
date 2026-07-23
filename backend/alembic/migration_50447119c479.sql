-- Migration: 50447119c479 create contacts table
-- Run this in Supabase Dashboard > SQL Editor
-- Generated: 2026-07-22

BEGIN;

CREATE TABLE contacts (
    id UUID DEFAULT gen_random_uuid() NOT NULL,
    wa_id VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (wa_id)
);

INSERT INTO alembic_version (version_num) VALUES ('50447119c479');

COMMIT;
