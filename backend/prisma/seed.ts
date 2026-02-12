import { PrismaClient, UserRole } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  const email = process.env.OWNER_EMAIL
  const password = process.env.OWNER_PASSWORD

  if (!email || !password) {
    throw new Error('OWNER_EMAIL or OWNER_PASSWORD not set in .env')
  }

  const existing = await prisma.user.findUnique({
    where: { email },
  })

  if (existing) {
    console.log('OWNER already exists')
    return
  }

  const hash = await bcrypt.hash(password, 10)

  await prisma.user.create({
    data: {
      email,
      passwordHash: hash,
      role: UserRole.OWNER,
    },
  })

  console.log('OWNER created successfully')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
