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

export type TemplateType = "TWR" | "APP" | "CTR";

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
  name: string;
  displayName: string;
  templatePath: string;
  
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
  APP: {
    name: "APP",
    displayName: "Approach (APP)",
    templatePath: "/banner/cpt-template/EDMM/APP/EmptyTemplateV1.png",
    
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
        font: "Arial",
        size: 64,
        color: "#6d8db8",
        bold: true,
      },
    },
    
    date: {
      position: { x: 1437, y: 105, align: "left" },
      style: {
        font: "Arial",
        size: 64,
        color: "#6d8db8",
        bold: true,
      },
      format: "DD.MM.YYYY",
    },
    
    time: {
      position: { x: 1437, y: 105, align: "left" }, // Same line as date
      style: {
        font: "Arial",
        size: 64,
        color: "#6d8db8",
        bold: true,
      },
      format: "HHMMz",
      separator: " | ",
    },
    
    fallbackGradient: {
      start: "#134e4a",
      end: "#14b8a6",
    },
  },
  
  TWR: {
    name: "TWR",
    displayName: "Tower (TWR)",
    templatePath: "/banner/cpt-template/EDMM/TWR/EmptyTemplateV1.png",
    
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
        font: "Arial",
        size: 64,
        color: "#6d8db8",
        bold: true,
      },
    },
    
    date: {
      position: { x: 1437, y: 105, align: "left" },
      style: {
        font: "Arial",
        size: 64,
        color: "#6d8db8",
        bold: true,
      },
      format: "DD.MM.YYYY",
    },
    
    time: {
      position: { x: 1437, y: 105, align: "left" },
      style: {
        font: "Arial",
        size: 64,
        color: "#6d8db8",
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
  
  CTR: {
    name: "CTR",
    displayName: "Center (CTR)",
    templatePath: "/banner/cpt-template/EDMM/CTR/EmptyTemplateV1.png",
    
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
        font: "Arial",
        size: 64,
        color: "#6d8db8",
        bold: true,
      },
    },
    
    date: {
      position: { x: 1437, y: 105, align: "left" },
      style: {
        font: "Arial",
        size: 64,
        color: "#6d8db8",
        bold: true,
      },
      format: "DD.MM.YYYY",
    },
    
    time: {
      position: { x: 1437, y: 105, align: "left" },
      style: {
        font: "Arial",
        size: 64,
        color: "#6d8db8",
        bold: true,
      },
      format: "HHMMz",
      separator: " | ",
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
    value: config.name as TemplateType,
    label: config.displayName,
  }));
}
