#!/usr/bin/env tsx
/**
 * Manual test script for event reminder functionality
 * Run with: npx tsx scripts/testEventReminder.ts
 */

import "dotenv/config";
import { PrismaClient } from '@prisma/client';
import { createDatabaseAdapter } from '../lib/db-adapter';
import { addDays, startOfDay, endOfDay } from 'date-fns';

const adapter = createDatabaseAdapter();
const prisma = new PrismaClient({ adapter });

async function testEventReminderLogic() {
  console.log('=== Testing Event Reminder Logic ===\n');

  // Calculate date range for events starting in 3 weeks (21 days from now)
  const targetDate = addDays(new Date(), 21);
  const dayStart = startOfDay(targetDate);
  const dayEnd = endOfDay(targetDate);

  console.log('Current date:', new Date().toISOString());
  console.log('Target date (21 days from now):', targetDate.toISOString());
  console.log('Date range:', dayStart.toISOString(), 'to', dayEnd.toISOString());
  console.log();

  // Query for events that would trigger reminders
  const eventsNeedingReminder = await prisma.event.findMany({
    where: {
      startTime: {
        gte: dayStart,
        lte: dayEnd,
      },
      status: {
        notIn: ["SIGNUP_OPEN", "SIGNUP_CLOSED", "ROSTER_PUBLISHED", "CANCELLED"],
      },
      firCode: {
        not: null,
      },
    },
    include: {
      fir: {
        include: {
          groups: {
            where: {
              kind: "FIR_LEITUNG"
            },
            include: {
              members: {
                include: {
                  user: true
                }
              }
            }
          }
        }
      }
    },
  });

  console.log(`Found ${eventsNeedingReminder.length} event(s) that would need reminders:\n`);

  for (const event of eventsNeedingReminder) {
    console.log(`Event: ${event.name}`);
    console.log(`  ID: ${event.id}`);
    console.log(`  Start Time: ${event.startTime.toISOString()}`);
    console.log(`  Status: ${event.status}`);
    console.log(`  FIR: ${event.fir?.code || 'N/A'}`);
    
    const firLeaders = event.fir?.groups.flatMap(group => 
      group.members.map(member => member.user)
    ) || [];
    
    console.log(`  FIR Leaders (${firLeaders.length}):`);
    firLeaders.forEach(leader => {
      console.log(`    - ${leader.name} (CID: ${leader.cid})`);
    });
    console.log();
  }

  // Summary
  console.log('=== Summary ===');
  console.log(`Total events that would trigger reminders: ${eventsNeedingReminder.length}`);
  
  const totalLeaders = eventsNeedingReminder.reduce((sum, event) => {
    const firLeaders = event.fir?.groups.flatMap(group => 
      group.members.map(member => member.user)
    ) || [];
    return sum + firLeaders.length;
  }, 0);
  
  console.log(`Total FIR leaders that would be notified: ${totalLeaders}`);

  await prisma.$disconnect();
}

testEventReminderLogic().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
