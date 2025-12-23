import { prisma } from "@/lib/prisma";

const VATGER_API_TOKEN = process.env.VATGER_API_TOKEN!;

export async function notifyRosterPublished(eventId: number) {
  if(!prisma) return;
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new Error("Event not found");

  const signups = await prisma.eventSignup.findMany({
    where: { eventId },
    include: { user: true },
  });
  if (signups.length === 0) return 0;

  const message = `Das Roster für ${event.name} wurde veröffentlicht! Schau gleich nach, auf welcher Position du eingeteilt bist.`;

  await prisma.$transaction(
    signups.map((s) =>
      prisma!.notification.create({
        data: {
          userCID: s.user.cid,
          eventId,
          type: "EVENT",
          title: "Roster veröffentlicht",
          message,
        },
      })
    )
  );

  
  const results = await Promise.allSettled(
    signups.map((s) => {
      const isEmailNotifEnabled = s.user.emailNotificationsEnabled ?? false;
      const body = {
        title: `Roster veröffentlicht – ${event.name}`,
        message,
        source_name: "Eventsystem",
        link_text: "Jetzt ansehen",
        link_url: `${process.env.NEXTAUTH_URL}/events/${event.id}`,
        ...(isEmailNotifEnabled ? {} : { via: "board.ping" }),
      };
      fetch(`${process.env.VATGER_API}/${s.user.cid}/send_notification`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${VATGER_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })
    }
    )
  );

  return results.filter((r) => r.status === "fulfilled").length;
}
