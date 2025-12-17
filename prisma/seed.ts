import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import 'dotenv/config';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  // Create the default user (Brett)
  const brett = await prisma.person.upsert({
    where: { handle: 'brett' },
    update: {},
    create: {
      handle: 'brett',
      displayName: 'Brett Burbidge',
      email: 'brett@example.com',
      source: 'manual',
    },
  });

  console.log('Created user:', brett);

  // Create a sample project
  const sampleProject = await prisma.project.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Papa Development',
      description: 'Building the Personal AI Project Assistant',
      isActive: true,
    },
  });

  console.log('Created project:', sampleProject);

  console.log('Seeding complete!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

