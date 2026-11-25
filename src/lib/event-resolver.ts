import prisma from '@/lib/prisma';

/**
 * Resolves a target wedding event by ID or slug, falling back cleanly
 * to the most recent active event or creating a default Reception event.
 */
export async function resolveTargetEvent(eventId?: string | null) {
  let event = eventId
    ? await prisma.event.findFirst({
        where: {
          OR: [{ id: eventId }, { slug: eventId }],
        },
      })
    : null;

  if (!event) {
    event = await prisma.event.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { eventDate: 'desc' },
    });
  }

  if (!event) {
    event = await prisma.event.findFirst({
      orderBy: { eventDate: 'desc' },
    });
  }

  if (!event) {
    event = await prisma.event.create({
      data: {
        title: 'Wedding Celebration',
        slug: 'reception',
        eventDate: new Date(),
        status: 'ACTIVE',
      },
    });
  }

  return event;
}
