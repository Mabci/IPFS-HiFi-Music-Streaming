import { PrismaClient } from '@prisma/client'

async function createUserProfileTable() {
  const prisma = new PrismaClient()
  
  try {
    console.log('Creating UserProfile table...')
    
    // Create UserProfile table
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "UserProfile" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "username" TEXT NOT NULL,
        "displayName" TEXT,
        "bio" TEXT,
        "avatar" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        
        CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "UserProfile_userId_key" UNIQUE ("userId"),
        CONSTRAINT "UserProfile_username_key" UNIQUE ("username"),
        CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
      );
    `
    console.log('✓ UserProfile table created')
    
    // Create indexes
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "UserProfile_username_idx" ON "UserProfile"("username");`
    console.log('✓ Username index created')
    
    // Verify table exists
    const result = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'UserProfile' 
      AND table_schema = 'public'
      ORDER BY column_name;
    `
    
    console.log('\nUserProfile table columns:')
    console.table(result)
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createUserProfileTable()
