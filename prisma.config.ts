import { defineConfig } from '@prisma/config'
import { config } from 'dotenv'

config({ path: '.env.local' })

export default defineConfig({
  migrations: {
    seed: 'npx tsx prisma/seed.ts',
  },
  datasource: {
    // Use direct connection for migrations/db push; app uses pooler via DATABASE_URL
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
})
