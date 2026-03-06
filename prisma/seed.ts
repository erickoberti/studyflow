import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Keep database clean by default: no mocked disciplines/subjects/sessions.
  // We only remove legacy demo user if it exists.
  await prisma.user.deleteMany({
    where: {
      email: "demo@studyflow.com",
    },
  });

  console.log("Seed concluído sem dados mockados.");
  console.log("Agora você pode criar conta e importar sua planilha.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });