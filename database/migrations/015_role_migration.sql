-- Migration to update profile roles from old names to new consolidated roles
-- This handles the transition from 7 roles to 5 internal roles + CUSTOMER

-- Note: If the enum was already updated, the old role values won't exist
-- This migration handles both cases

-- Update old role names to new role names (if they exist)
UPDATE profiles 
SET role = 'PLATFORM_ADMIN'::text::app_role 
WHERE role::text = 'ADMIN';

UPDATE profiles 
SET role = 'OPERATIONS'::text::app_role 
WHERE role::text IN ('OPERATIONS_MANAGER', 'OPERATIONS_AGENT');

-- Handle deprecated roles (if they exist in the enum)
UPDATE profiles 
SET role = 'CUSTOMER'::text::app_role 
WHERE role::text IN ('CUSTOMER_SUPPORT', 'DELIVERY_PARTNER');

-- Verify the migration
SELECT role, COUNT(*) as count 
FROM profiles 
GROUP BY role 
ORDER BY role;
