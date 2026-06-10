import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = await hash("hikeplanner2024", 12);

  await prisma.user.upsert({
    where: { email: "martina@hikeplanner.local" },
    update: { name: "Martina" },
    create: {
      name: "Martina",
      email: "martina@hikeplanner.local",
      passwordHash: password,
    },
  });

  await prisma.user.upsert({
    where: { email: "sebastian@hikeplanner.local" },
    update: { name: "Sebastian" },
    create: {
      name: "Sebastian",
      email: "sebastian@hikeplanner.local",
      passwordHash: password,
    },
  });

  console.log("Seeded 2 users: martina@hikeplanner.local, sebastian@hikeplanner.local (password: hikeplanner2024)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
