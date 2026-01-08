import dayjs from "dayjs";
import { ChannelType } from "discord.js";
import { weeklyEvents } from "../events/weeklyEvents";
import { vatsimService } from "../services/vatsim.service";
import { client } from "../client";

export async function runWeeklyStaffingCheck() {
  const now = new Date();

  for (const event of weeklyEvents) {
    if (now.getDay() !== event.weekday) continue;

    const channel = await client.channels.fetch(event.channelId);
    if (!channel || channel.type !== ChannelType.GuildText) continue;

    const events = await vatsimService.getEvents();
    const bookings = await vatsimService.getBookings();

    const today = dayjs().format("YYYY-MM-DD");
    const plus14 = dayjs().add(14, "day").format("YYYY-MM-DD");

    const matching = events.filter(e =>
      e.name.toLowerCase().includes(event.label.toLowerCase())
    );

    // ❌ Event nicht eingetragen (14 Tage vorher)
    if (!matching.some(e => e.start_time.startsWith(plus14))) {
      await channel.send(
        `<@&${event.pingId}> ❌ **${event.label}** ist noch nicht für ${dayjs(plus14).format("DD.MM.YYYY")} eingetragen`
      );
      return;
    }

    const todayEvent = matching.find(e =>
      e.start_time.startsWith(today)
    );
    if (!todayEvent) return;

    const start = new Date(todayEvent.start_time);
    const bookingsForEvent = bookings.filter(b =>
      start >= new Date(b.start) && start < new Date(b.end)
    );

    const problems = [];

    for (const [regex, required] of Object.entries(event.requiredStaffing)) {
      const r = new RegExp(regex, "i");
      const booked = bookingsForEvent.filter(b => r.test(b.callsign)).length;
      if (booked < required) {
        problems.push(`❌ ${regex}: ${booked}/${required}`);
      }
    }

    if (problems.length) {
      await channel.send(
        `⚠️ **${event.label} – Staffing fehlt**\n` + problems.join("\n")
      );
    }
  }
}
