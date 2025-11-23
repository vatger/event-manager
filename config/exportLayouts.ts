/**
 * Export Layout Configurations for different FIRs
 * Each FIR can have its own layout configuration
 */

import { ExportLayoutConfig, ConvertedEvent, ConvertedSignup, ComputedUserData } from "@/types/exportLayout";
import { formatDateGerman, isUserAvailable } from "@/lib/export/exportUtils";
import { EDMMLayout } from "./layouts/EDMM";


/**
 * Layout registry - maps FIR codes to their configurations
 */
export const FIRLayoutRegistry: Record<string, ExportLayoutConfig> = {
  "EDMM": EDMMLayout,
  // EDGG and EDWW can be added here with their own layouts
  // For now, they will use the default layout
};

/**
 * Get the layout configuration for a specific FIR
 * Falls back to EDMM layout if no specific layout is found
 */
export function getLayoutForFIR(firCode: string): ExportLayoutConfig {
  return FIRLayoutRegistry[firCode] || EDMMLayout;
}

/**
 * Get the Google Sheet ID for a specific FIR
 * Falls back to default GOOGLE_SHEET_ID if no specific ID is found
 */
export function getSheetIdForFIR(firCode: string): string | undefined {
  const envKey = `GOOGLE_SHEET_ID_${firCode}`;
  const firSpecificId = process.env[envKey];
  
  if (firSpecificId) {
    return firSpecificId;
  }
  
  // Fallback to default GOOGLE_SHEET_ID
  return process.env.GOOGLE_SHEET_ID;
}
