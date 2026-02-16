import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import crypto from "crypto";
import "dotenv/config";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Fixed UUIDs so the seed is idempotent and predictable
const SEED_USER_ID = "00000000-0000-0000-0000-000000000000";
const SEED_PROJECT_ID = "00000000-0000-0000-0000-000000000001";
const SEED_API_KEY_ID = "00000000-0000-0000-0000-000000000002";

async function main() {
  console.log("Seeding database...");

  // 1. Create the User record (mirrors Supabase auth user)
  const user = await prisma.user.upsert({
    where: { id: SEED_USER_ID },
    update: {},
    create: {
      id: SEED_USER_ID,
      email: "brett@example.com",
    },
  });

  console.log("Created user:", user);

  // 2. Create the "me" person entry (auto-created by hooks on first login)
  const me = await prisma.person.upsert({
    where: { userId_handle: { userId: SEED_USER_ID, handle: "me" } },
    update: {},
    create: {
      userId: SEED_USER_ID,
      handle: "me",
      displayName: "Brett",
      email: "brett@example.com",
      source: "auto",
    },
  });

  console.log("Created 'me' person:", me);

  // 3. Create a sample project
  const sampleProject = await prisma.project.upsert({
    where: { id: SEED_PROJECT_ID },
    update: {},
    create: {
      id: SEED_PROJECT_ID,
      userId: SEED_USER_ID,
      name: "Taskline Development",
      description: "Building the Personal AI Project Assistant",
      isActive: true,
    },
  });

  console.log("Created project:", sampleProject);

  // 4. Create a default API key for local dev
  const existingKey = await prisma.apiKey.findUnique({ where: { id: SEED_API_KEY_ID } });
  let apiKeyValue: string;
  if (existingKey) {
    apiKeyValue = existingKey.key;
    console.log("API key already exists, skipping creation.");
  } else {
    apiKeyValue = crypto.randomBytes(32).toString("hex");
    const apiKey = await prisma.apiKey.create({
      data: {
        id: SEED_API_KEY_ID,
        userId: SEED_USER_ID,
        key: apiKeyValue,
        name: "Local Dev",
      },
    });
    console.log("Created API key:", apiKey.name);
  }

  console.log("\nSeeding complete!");
  console.log(`\nYour API key for local development:\n  ${apiKeyValue}`);
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
