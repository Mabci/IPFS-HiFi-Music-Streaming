import { PrismaClient } from '@prisma/client'

async function addMissingColumns() {
  const prisma = new PrismaClient()
  
  try {
    console.log('Adding missing columns to User table...')
    
    // Add passwordHash column
    await prisma.$executeRaw`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;`
    console.log('✓ passwordHash column added')
    
    // Add emailVerified column  
    await prisma.$executeRaw`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerified" TIMESTAMP(3);`
    console.log('✓ emailVerified column added')
    
    // Create index
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "User_email_verified_idx" ON "User"("emailVerified");`
    console.log('✓ Index created')
    
    // Verify columns exist
    const result = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'User' 
      AND table_schema = 'public'
      ORDER BY column_name;
    `
    
    console.log('\nCurrent User table columns:')
    console.table(result)
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

addMissingColumns()
