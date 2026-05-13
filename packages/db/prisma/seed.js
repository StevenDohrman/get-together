import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({
  path: path.resolve(__dirname, '../../../.env.local'),
  override: true,
});

const interestsList = JSON.parse(
  readFileSync(path.join(__dirname, 'interest-data.json'), 'utf8'),
);

const connectionString =
  globalThis.process?.env?.DIRECT_URL ?? globalThis.process?.env?.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    'Missing DATABASE_URL (or DIRECT_URL). Add it to the root .env before running prisma db seed.',
  );
}

const { Pool } = pg;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

async function main() {
  const email = 'seed@example.com';

  const user = await prisma.user.upsert({
    where: { email },
    update: { displayName: 'Seed User' },
    create: { email, displayName: 'Seed User' },
  });

  const group = await prisma.group.upsert({
    where: { slug: 'uconnect' },
    update: { name: 'UConnect' },
    create: {
      slug: 'uconnect',
      name: 'UConnect',
      description: 'Seed group',
      createdById: user.id,
    },
  });

  // Create or update interests from the JSON data file.
  const created = {};
  for (const item of interestsList) {
    const up = await prisma.interest.upsert({
      where: { slug: item.slug },
      update: {
        name: item.name,
        metadata: item.metadata ?? null,
        isRoot: !!item.isRoot,
      },
      create: {
        slug: item.slug,
        name: item.name,
        metadata: item.metadata ?? null,
        isRoot: !!item.isRoot,
      },
    });
    created[item.slug] = up;
  }

  // Create relation edges after all interests exist
  for (const item of interestsList) {
    const child = created[item.slug];
    if (!child) continue;
    const parents = item.parents || [];
    for (const parentSlug of parents) {
      const parent = created[parentSlug];
      if (!parent) continue;
      // Upsert InterestRelation via composite key (parentId, childId)
      await prisma.interestRelation.upsert({
        where: { parentId_childId: { parentId: parent.id, childId: child.id } },
        update: {},
        create: { parentId: parent.id, childId: child.id },
      });
    }
  }

  const interests = Object.values(created);

  await prisma.userInterest.upsert({
    where: {
      userId_interestId: { userId: user.id, interestId: interests[0].id },
    },
    update: { weight: 9 },
    create: { userId: user.id, interestId: interests[0].id, weight: 9 },
  });

  await prisma.userInterest.upsert({
    where: {
      userId_interestId: { userId: user.id, interestId: interests[1].id },
    },
    update: { weight: 7 },
    create: { userId: user.id, interestId: interests[1].id, weight: 7 },
  });

  await prisma.groupInterest.upsert({
    where: {
      groupId_interestId: { groupId: group.id, interestId: interests[1].id },
    },
    update: { weight: 8 },
    create: { groupId: group.id, interestId: interests[1].id, weight: 8 },
  });

  await prisma.groupInterest.upsert({
    where: {
      groupId_interestId: { groupId: group.id, interestId: interests[2].id },
    },
    update: { weight: 6 },
    create: { groupId: group.id, interestId: interests[2].id, weight: 6 },
  });

  const eventData = {
    title: 'Coffee meetup',
    description: 'Seed event',
    startsAt: addDays(new Date(), 1),
    locationName: 'Cafe',
    createdById: user.id,
    groupId: group.id,
  };

  const existingEvent = await prisma.event.findFirst({
    where: {
      title: eventData.title,
      createdById: user.id,
      groupId: group.id,
    },
  });

  const event = existingEvent
    ? await prisma.event.update({
        where: { id: existingEvent.id },
        data: eventData,
      })
    : await prisma.event.create({
        data: eventData,
      });

  await prisma.groupMember.upsert({
    where: { groupId_userId: { groupId: group.id, userId: user.id } },
    update: { role: 'OWNER' },
    create: { groupId: group.id, userId: user.id, role: 'OWNER' },
  });

  await prisma.eventAttendee.upsert({
    where: { eventId_userId: { eventId: event.id, userId: user.id } },
    update: { status: 'GOING' },
    create: { eventId: event.id, userId: user.id, status: 'GOING' },
  });

  return { userId: user.id, groupId: group.id, eventId: event.id };
}

main()
  .then((result) => {
    globalThis.console.log('Seed complete:', result);
  })
  .catch((err) => {
    globalThis.console.error('Seed failed:', err);
    if (globalThis.process) {
      globalThis.process.exitCode = 1;
    }
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
