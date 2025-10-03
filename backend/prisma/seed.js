import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create instructor user
  await prisma.user.upsert({
    where: { email: 'instructor@example.com' },
    update: {
      name: 'Demo Instructor',
      password: 'password123',
    },
    create: {
      name: 'Demo Instructor',
      email: 'instructor@example.com',
      password: 'password123',
      role: 'instructor',
    },
  });

  // Create student user
  await prisma.user.upsert({
    where: { email: 'student@example.com' },
    update: {
      name: 'Demo Student',
      password: 'password123',
    },
    create: {
      name: 'Demo Student',
      email: 'student@example.com',
      password: 'password123',
      role: 'student',
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('Seed error:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
