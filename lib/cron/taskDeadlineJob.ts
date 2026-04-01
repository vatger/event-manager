import prisma from "@/lib/prisma";

const VATGER_API_TOKEN = process.env.VATGER_API_TOKEN!;

/**
 * Cron job: checks for event tasks whose deadline is within 2 days
 * and sends a forum ping (via VATGER API) to the assigned person.
 * Only notifies once per task (uses `deadlineNotified` flag).
 */
export async function checkTaskDeadlines() {
  if (!prisma) {
    console.log("[Task Deadlines] Prisma not available, skipping");
    return { checked: 0, notified: 0 };
  }

  const now = new Date();
  const twoDaysFromNow = new Date(now);
  twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);

  // Find tasks that:
  // - have a deadline within the next 2 days
  // - are not yet completed or skipped
  // - have not been notified yet
  // - have an assignee
  const tasks = await prisma.eventTask.findMany({
    where: {
      dueDate: {
        lte: twoDaysFromNow,
        gte: now,
      },
      status: { in: ["OPEN", "IN_PROGRESS"] },
      deadlineNotified: false,
      assigneeCID: { not: null },
    },
    include: {
      event: { select: { id: true, name: true, startTime: true } },
      assignee: {
        select: {
          cid: true,
          name: true,
          emailNotificationsEnabled: true,
        },
      },
    },
  });

  if (tasks.length === 0) {
    console.log("[Task Deadlines] No tasks approaching deadline");
    return { checked: 0, notified: 0 };
  }

  console.log(`[Task Deadlines] Found ${tasks.length} tasks approaching deadline`);

  let notifiedCount = 0;

  for (const task of tasks) {
    if (!task.assignee || !task.dueDate) continue;

    const dueDateStr = task.dueDate.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    const message = `Erinnerung: Die Aufgabe "${task.title}" für das Event "${task.event.name}" hat eine Deadline am ${dueDateStr}. Bitte kümmere dich zeitnah darum.`;

    try {
      // Create in-app notification
      await prisma.notification.create({
        data: {
          userCID: task.assignee.cid,
          eventId: task.event.id,
          type: "EVENT",
          title: "Aufgaben-Deadline",
          message,
        },
      });

      // Send external notification via VATGER API (forum ping by default)
      if (VATGER_API_TOKEN && process.env.VATGER_API) {
        const isEmailNotif = task.assignee.emailNotificationsEnabled ?? false;
        const body = {
          title: `Aufgaben-Deadline – ${task.event.name}`,
          message,
          source_name: "Eventsystem",
          link_text: "Aufgabe ansehen",
          link_url: `${process.env.NEXTAUTH_URL}/admin/events/${task.event.id}/tasks`,
          ...(isEmailNotif ? {} : { via: "board.ping" }),
        };

        await fetch(
          `${process.env.VATGER_API}/${task.assignee.cid}/send_notification`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${VATGER_API_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          }
        );
      }

      // Mark task as notified
      await prisma.eventTask.update({
        where: { id: task.id },
        data: { deadlineNotified: true },
      });

      notifiedCount++;
      console.log(
        `[Task Deadlines] Notified ${task.assignee.name} (CID ${task.assignee.cid}) about task "${task.title}" for event "${task.event.name}"`
      );
    } catch (error) {
      console.error(
        `[Task Deadlines] Failed to notify for task ${task.id}:`,
        error
      );
    }
  }

  console.log(
    `[Task Deadlines] Notified ${notifiedCount}/${tasks.length} task assignees`
  );
  return { checked: tasks.length, notified: notifiedCount };
}
