import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

  const interests = await Promise.all(
    [
      { slug: 'coffee', name: 'Coffee' },
      { slug: 'hiking', name: 'Hiking' },
      { slug: 'board-games', name: 'Board Games' },
    ].map((interest) =>
      prisma.interest.upsert({
        where: { slug: interest.slug },
        update: { name: interest.name },
        create: interest,
      }),
    ),
  );

  await prisma.userInterest.upsert({
    where: { userId_interestId: { userId: user.id, interestId: interests[0].id } },
    update: { weight: 9 },
    create: { userId: user.id, interestId: interests[0].id, weight: 9 },
  });

  await prisma.userInterest.upsert({
    where: { userId_interestId: { userId: user.id, interestId: interests[1].id } },
    update: { weight: 7 },
    create: { userId: user.id, interestId: interests[1].id, weight: 7 },
  });

  await prisma.groupInterest.upsert({
    where: { groupId_interestId: { groupId: group.id, interestId: interests[1].id } },
    update: { weight: 8 },
    create: { groupId: group.id, interestId: interests[1].id, weight: 8 },
  });

  await prisma.groupInterest.upsert({
    where: { groupId_interestId: { groupId: group.id, interestId: interests[2].id } },
    update: { weight: 6 },
    create: { groupId: group.id, interestId: interests[2].id, weight: 6 },
  });

  const event = await prisma.event.create({
    data: {
      title: 'Coffee meetup',
      description: 'Seed event',
      startsAt: addDays(new Date(), 1),
      locationName: 'Cafe',
      createdById: user.id,
      groupId: group.id,
    },
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
    // eslint-disable-next-line no-console
    console.log('Seed complete:', result);
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
