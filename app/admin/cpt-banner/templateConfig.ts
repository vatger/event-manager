/**
 * Template Configuration for CPT Banner Generator
 * 
 * This file centralizes all template-specific settings including:
 * - Text positions
 * - Font styles and sizes
 * - Colors
 * - Template paths
 * 
 * To add a new template:
 * 1. Add a new entry to the TemplateConfig object
 * 2. Place the template image in /public/banner/cpt-template/EDMM/{TEMPLATE_NAME}/EmptyTemplateV1.png
 * 3. Update the TemplateType union type
 */

export type TemplateType = "EDDMTWR" | "EDDNTWR" | "APP" | "CTR";

export interface TextStyle {
  font: string;
  size: number;
  color: string;
  bold?: boolean;
}

export interface TextPosition {
  x: number;
  y: number;
  align?: "left" | "center" | "right";
}

export interface TemplateSettings {
  Templatename: string;
  displayName: string;
  templatePath: string;
  
  // Indicates if this template requires a station parameter
  requiresStation?: boolean;
  
  // Text elements configuration
  name: {
    position: TextPosition;
    style: TextStyle;
    prefix?: string; // e.g., "feat "
  };
  
  weekday: {
    position: TextPosition;
    style: TextStyle;
  };
  
  date: {
    position: TextPosition;
    style: TextStyle;
    format: string; // e.g., "DD.MM.YYYY"
  };
  
  time: {
    position: TextPosition;
    style: TextStyle;
    format: string; // e.g., "HHMMz"
    separator?: string; // e.g., " | "
  };
  
  // Optional station configuration (for templates that need it)
  station?: {
    position: TextPosition;
    style: TextStyle;
  };
  
  // Optional fallback gradient colors (for templates without images)
  fallbackGradient?: {
    start: string;
    end: string;
  };
}

/**
 * Template Configuration
 * 
 * Each template key should match the TemplateType
 */
export const TemplateConfig: Record<TemplateType, TemplateSettings> = {
  
  EDDMTWR: {
    Templatename: "TWR EDDM",
    displayName: "Tower (EDDM)",
    templatePath: "/banner/cpt-template/EDDM/TWR/EmptyTemplateV1.png",
    
    name: {
      position: { x: 428, y: 692, align: "left" },
      style: {
        font: "Arial",
        size: 62,
        color: "#FFFFFF",
        bold: true,
      },
      prefix: "feat ",
    },
    
    weekday: {
      position: { x: 1438, y: 47, align: "left" },
      style: {
        font: "MontserratBold",
        size: 50,
        color: "#f8b27e",
        bold: true,
      },
    },
    
    date: {
      position: { x: 1437, y: 100, align: "left" },
      style: {
        font: "MontserratBold",
        size: 50,
        color: "#f8b27e",
        bold: true,
      },
      format: "DD.MM.YYYY",
    },
    
    time: {
      position: { x: 1437, y: 100, align: "left" },
      style: {
        font: "MontserratBold",
        size: 50,
        color: "#f8b27e",
        bold: true,
      },
      format: "HHMMz",
      separator: " | ",
    },
    
    fallbackGradient: {
      start: "#1e3a8a",
      end: "#3b82f6",
    },
  },

  EDDNTWR: {
    Templatename: "TWR EDDN",
    displayName: "Tower (EDDN)",
    templatePath: "/banner/cpt-template/EDDN/TWR/EmptyTemplateV1.png",
    
    name: {
      position: { x: 428, y: 692, align: "left" },
      style: {
        font: "Arial",
        size: 62,
        color: "#FFFFFF",
        bold: true,
      },
      prefix: "feat ",
    },
    
    weekday: {
      position: { x: 1438, y: 47, align: "left" },
      style: {
        font: "MontserratBold",
        size: 50,
        color: "#b4bcc9",
        bold: true,
      },
    },
    
    date: {
      position: { x: 1437, y: 100, align: "left" },
      style: {
        font: "MontserratBold",
        size: 50,
        color: "#b4bcc9",
        bold: true,
      },
      format: "DD.MM.YYYY",
    },
    
    time: {
      position: { x: 1437, y: 100, align: "left" },
      style: {
        font: "MontserratBold",
        size: 50,
        color: "#b4bcc9",
        bold: true,
      },
      format: "HHMMz",
      separator: " | ",
    },
    
    fallbackGradient: {
      start: "#1e3a8a",
      end: "#3b82f6",
    },
  },

  APP: {
    Templatename: "APP",
    displayName: "Approach (EDDM)",
    templatePath: "/banner/cpt-template/EDDM/APP/EmptyTemplateV1.png",
    
    name: {
      position: { x: 428, y: 692, align: "left" },
      style: {
        font: "Arial",
        size: 62,
        color: "#FFFFFF",
        bold: true,
      },
      prefix: "feat ",
    },
    
    weekday: {
      position: { x: 1480, y: 47, align: "left" },
      style: {
        font: "MontserratBold",
        size: 50,
        color: "#6d8db8",
        bold: true,
      },
    },
    
    date: {
      position: { x: 1480, y: 100, align: "left" },
      style: {
        font: "MontserratBold",
        size: 50,
        color: "#6d8db8",
        bold: true,
      },
      format: "DD.MM.YYYY",
    },
    
    time: {
      position: { x: 1480, y: 100, align: "left" }, // Same line as date
      style: {
        font: "MontserratBold",
        size: 50,
        color: "#6d8db8",
        bold: true,
      },
      format: "HHMMz",
      separator: "|",
    },
    
    fallbackGradient: {
      start: "#134e4a",
      end: "#14b8a6",
    },
  },

  CTR: {
    Templatename: "CTR",
    displayName: "Center (EDMM)",
    templatePath: "/banner/cpt-template/EDDM/CTR/EmptyTemplateV1.png",
    requiresStation: true, // CTR template requires station parameter
    
    name: {
      position: { x: 696, y: 719, align: "left" },
      style: {
        font: "Arial",
        size: 62,
        color: "#000000",
        bold: true,
      },
      prefix: "feat ",
    },
    
    weekday: {
      position: { x: 1438, y: 47, align: "left" },
      style: {
        font: "Arial",
        size: -1,
        color: "#6d8db8",
        bold: true,
      },
    },
    
    date: {
      position: { x: 1437, y: 105, align: "left" },
      style: {
        font: "MontserratBold",
        size: 50,
        color: "#dccfc8",
        bold: true,
      },
      format: "DD.MM.YYYY",
    },
    
    time: {
      position: { x: 1437, y: 105, align: "left" },
      style: {
        font: "MontserratBold",
        size: 50,
        color: "#dccfc8",
        bold: true,
      },
      format: "HHMMz",
      separator: " | ",
    },
    
    // Station configuration for CTR template
    station: {
      position: { x: 1438, y: 47, align: "left" },
      style: {
        font: "MontserratBold",
        size: 50,
        color: "#dccfc8",
        bold: true,
      },
    },
    
    fallbackGradient: {
      start: "#7c2d12",
      end: "#f97316",
    },
  },
};

/**
 * Get template configuration by type
 */
export function getTemplateConfig(template: TemplateType): TemplateSettings {
  return TemplateConfig[template];
}

/**
 * Get all available templates
 */
export function getAvailableTemplates(): Array<{ value: TemplateType; label: string }> {
  return Object.values(TemplateConfig).map((config) => ({
    value: config.Templatename as TemplateType,
    label: config.displayName,
  }));
}
