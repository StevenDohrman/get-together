import { prisma } from '@uconnect/db';

export let prismaClient = prisma;

export function setPrismaClientForTests(client: typeof prisma) {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('setPrismaClientForTests may only be used with NODE_ENV=test');
  }
  prismaClient = client;
}
