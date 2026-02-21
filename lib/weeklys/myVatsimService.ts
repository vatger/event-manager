/**
 * myVATSIM Integration Service
 * Checks if weekly event occurrences are registered on myVATSIM
 */

interface MyVatsimEvent {
  id: number;
  name: string;
  start_time: string;
  end_time: string;
  airports: Array<{ icao: string }>;
}

interface MyVatsimResponse {
  data: MyVatsimEvent[];
}

/**
 * Fetch events from myVATSIM API
 */
export async function fetchMyVatsimEvents(): Promise<MyVatsimEvent[]> {
  try {
    const response = await fetch("https://my.vatsim.net/api/v2/events/latest", {
      headers: {
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      console.error("[myVATSIM] API request failed:", response.status, response.statusText);
      return [];
    }

    const data: MyVatsimResponse = await response.json();
    return data.data || [];
  } catch (error) {
    console.error("[myVATSIM] Error fetching events:", error);
    return [];
  }
}

/**
 * Check if a weekly occurrence is registered on myVATSIM
 * @param occurrenceName - Name of the weekly event
 * @param occurrenceDate - Date of the occurrence
 * @returns true if found, false otherwise
 */
export async function checkOccurrenceInMyVatsim(
  occurrenceName: string,
  occurrenceDate: Date
): Promise<boolean> {
  const events = await fetchMyVatsimEvents();
  
  // Normalize the occurrence date to just the date part (ignore time)
  const targetDate = new Date(occurrenceDate);
  targetDate.setHours(0, 0, 0, 0);
  
  // Check if any event matches the name and date
  for (const event of events) {
    const eventDate = new Date(event.start_time);
    eventDate.setHours(0, 0, 0, 0);
    
    // Check if dates match and name is similar (case-insensitive, partial match)
    const nameMatch = event.name.toLowerCase().includes(occurrenceName.toLowerCase()) ||
                      occurrenceName.toLowerCase().includes(event.name.toLowerCase());
    const dateMatch = eventDate.getTime() === targetDate.getTime();
    
    if (nameMatch && dateMatch) {
      console.log(`[myVATSIM] Found matching event: ${event.name} on ${event.start_time}`);
      return true;
    }
  }
  
  return false;
}

/**
 * Check multiple occurrences against myVATSIM
 * @param occurrences - Array of occurrences to check
 * @returns Map of occurrence IDs to registration status
 */
export async function checkMultipleOccurrences(
  occurrences: Array<{ id: number; name: string; date: Date }>
): Promise<Map<number, boolean>> {
  const results = new Map<number, boolean>();
  const events = await fetchMyVatsimEvents();
  
  if (events.length === 0) {
    console.warn("[myVATSIM] No events fetched from API, all checks will return false");
    occurrences.forEach(occ => results.set(occ.id, false));
    return results;
  }
  
  for (const occurrence of occurrences) {
    const targetDate = new Date(occurrence.date);
    targetDate.setHours(0, 0, 0, 0);
    
    let found = false;
    for (const event of events) {
      const eventDate = new Date(event.start_time);
      eventDate.setHours(0, 0, 0, 0);
      
      const nameMatch = event.name.toLowerCase().includes(occurrence.name.toLowerCase()) ||
                        occurrence.name.toLowerCase().includes(event.name.toLowerCase());
      const dateMatch = eventDate.getTime() === targetDate.getTime();
      
      if (nameMatch && dateMatch) {
        found = true;
        break;
      }
    }
    
    results.set(occurrence.id, found);
  }
  
  return results;
}
