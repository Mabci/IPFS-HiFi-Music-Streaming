-- Add missing columns to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerified" TIMESTAMP(3);

-- Create index for emailVerified if it doesn't exist
CREATE INDEX IF NOT EXISTS "User_email_verified_idx" ON "User"("emailVerified");

-- Verify columns exist
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'User' 
AND table_schema = 'public'
ORDER BY column_name;
