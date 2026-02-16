/**
 * Utility functions for trainee detection in weekly events
 */

/**
 * Check if a user is a trainee based on their restrictions
 * A trainee has a "solo" restriction
 * @param restrictions Array of restriction strings
 * @returns true if user has solo restriction
 */
export function isTrainee(restrictions: string[] | undefined | null): boolean {
  if (!restrictions || !Array.isArray(restrictions)) {
    return false;
  }
  
  return restrictions.some(r => 
    typeof r === 'string' && r.toLowerCase().includes('solo')
  );
}

/**
 * Extract solo expiry date from restrictions if available
 * @param restrictions Array of restriction strings
 * @returns Solo expiry date string or null
 */
export function getSoloExpiryDate(restrictions: string[] | undefined | null): string | null {
  if (!restrictions || !Array.isArray(restrictions)) {
    return null;
  }
  
  const soloRestriction = restrictions.find(r => 
    typeof r === 'string' && r.toLowerCase().includes('solo')
  );
  
  if (!soloRestriction) {
    return null;
  }
  
  // Try to extract date from format like "solo: bis 01.03.2024" or "solo: EDDF bis 01.03.2024"
  const dateMatch = soloRestriction.match(/bis\s+(\d{2}\.\d{2}\.\d{4})/);
  return dateMatch ? dateMatch[1] : null;
}
