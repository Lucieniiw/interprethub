-- Run once if `users.account_locked` is missing (schema drift / DB older than migration).
-- Safe to run multiple times (PostgreSQL 11+).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "account_locked" BOOLEAN NOT NULL DEFAULT false;
