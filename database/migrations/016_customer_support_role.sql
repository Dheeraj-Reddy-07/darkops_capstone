-- Migration: Replace FRAUD_ANALYST with CUSTOMER_SUPPORT role
-- This migration updates existing profiles from FRAUD_ANALYST to CUSTOMER_SUPPORT

-- Update profiles with FRAUD_ANALYST role to CUSTOMER_SUPPORT
UPDATE profiles
SET role = 'CUSTOMER_SUPPORT'
WHERE role = 'FRAUD_ANALYST';

-- Note: The app_role enum has been updated in 002_enums.sql to replace FRAUD_ANALYST with CUSTOMER_SUPPORT
-- This migration ensures existing data is consistent with the new enum
