import prisma from "../prisma";
import { calculateSignupDeadline } from "./deadlineUtils";

/**
 * Generate occurrences for a weekly event configuration
 * Creates occurrences for the next 6 months
 */
export async function generateOccurrences(configId: number) {
    if (!prisma) return;
  
    const config = await prisma.weeklyEventConfiguration.findUnique({
      where: { id: configId },
    });
    if (!config) return;
  
    // Heute als reines UTC-Datum (Mitternacht UTC)
    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const endUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    endUTC.setUTCDate(endUTC.getUTCDate() + 26 * 7); // 26 Wochen voraus
  
    // startDate als reines UTC-Datum
    const sd = new Date(config.startDate);
    let cursor = new Date(Date.UTC(sd.getUTCFullYear(), sd.getUTCMonth(), sd.getUTCDate()));
  
    // Zum gewünschten Wochentag vorspulen (vorwärts)
    // weekday: 0=So, 1=Mo, 2=Di, ...
    const targetDay = config.weekday;
    while (cursor.getUTCDay() !== targetDay) {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  
    // Ab hier ist cursor exakt auf dem ersten korrekten Wochentag >= startDate
    // weekCounter auf 0 – cursor ist per Definition Woche 0 des Zyklus
    const weeksOn = config.weeksOn;
    const weeksOff = config.weeksOff;
    const cycleLength = weeksOn + weeksOff; // bei weeksOff=0 → cycleLength=weeksOn
  
    const occurrenceDates: Date[] = [];
    let weekCounter = 0;
  
    while (cursor <= endUTC) {
      const positionInCycle = weekCounter % cycleLength;
  
      // Nur in den ersten weeksOn Positionen des Zyklus ist ein Event
      if (positionInCycle < weeksOn) {
        if (cursor >= todayUTC) {
          occurrenceDates.push(new Date(cursor));
        }
      }
  
      cursor.setUTCDate(cursor.getUTCDate() + 7);
      weekCounter++;
    }
  
    // Upsert in DB
    for (const date of occurrenceDates) {
      const signupDeadline = calculateSignupDeadline(
        date,
        config.startTime,
        config.signupDeadlineHours
      );
  
      await prisma.weeklyEventOccurrence.upsert({
        where: {
          configId_date: {
            configId: config.id,
            date: date,
          },
        },
        create: {
          configId: config.id,
          date: date,
          signupDeadline: signupDeadline,
          eventId: null,
        },
        update: {
          signupDeadline: signupDeadline,
        },
      });
    }
  }