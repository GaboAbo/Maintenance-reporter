import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { config } from 'dotenv'

config({ path: '.env.local' })

function createClient() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

const db = createClient()

const SYSTEM_CATEGORIES = ['HVAC', 'Electrical', 'Plumbing', 'Equipment', 'Vehicle', 'Other']

async function main() {
  let inserted = 0
  for (const name of SYSTEM_CATEGORIES) {
    const existing = await db.assetCategory.findFirst({ where: { isSystem: true, name } })
    if (!existing) {
      await db.assetCategory.create({ data: { name, isSystem: true } })
      inserted++
    }
  }
  console.log(`Seeded ${inserted} system asset categories (${SYSTEM_CATEGORIES.length - inserted} already existed)`)
}

main().catch(console.error).finally(() => db.$disconnect())
