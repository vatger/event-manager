import { NextRequest, NextResponse } from 'next/server';
import { createCanvas, loadImage, registerFont } from 'canvas';
import { getTemplateConfig, type TemplateType } from '@/app/admin/edmm/cpt-banner/templateConfig';
import { join } from 'path';
import { existsSync } from 'fs';

// Register fonts once when the module loads
let fontsRegistered = false;

function ensureFontsRegistered() {
  if (fontsRegistered) return;
  
  try {
    const publicDir = join(process.cwd(), 'public');
    const boldPath = join(publicDir, 'fonts', 'Montserrat-Bold.ttf');
    const extraBoldPath = join(publicDir, 'fonts', 'Montserrat-ExtraBold.ttf');

    console.log('🔍 Checking fonts at:', { publicDir, boldPath, extraBoldPath });

    // Check if fonts exist
    if (!existsSync(boldPath)) {
      console.error('❌ Font not found:', boldPath);
      console.error('📁 Current working directory:', process.cwd());
      return;
    }
    if (!existsSync(extraBoldPath)) {
      console.error('❌ Font not found:', extraBoldPath);
      console.error('📁 Current working directory:', process.cwd());
      return;
    }

    // Register fonts with the EXACT same names as in the frontend
    registerFont(boldPath, {
      family: 'MontserratBold'
    });
    
    registerFont(extraBoldPath, {
      family: 'MontserratExtraBold'
    });
    
    fontsRegistered = true;
    console.log('✅ Fonts registered successfully');
    console.log('📝 Registered font families: MontserratBold, MontserratExtraBold');
  } catch (error) {
    console.error('❌ Error registering fonts:', error);
    console.error('📁 Current working directory:', process.cwd());
  }
}

/**
 * API Route: Generate CPT Banner Dynamically
 * 
 * This endpoint generates a banner image on-the-fly based on URL parameters.
 * No file storage needed - banners are generated on each request.
 * 
 * Query Parameters:
 * - template: Template type (EDDMTWR, EDDNTWR, APP, CTR)
 * - name: Controller name
 * - date: Date in YYYY-MM-DD format
 * - time: Start time in HH:MM format
 * - station: Station code (optional, required for some templates like CTR)
 * 
 * Example:
 * /api/cpt-banner/generate?template=APP&name=Peter%20Zwegat&date=2024-12-15&time=12:34
 */

export async function GET(request: NextRequest) {
  try {
    // Ensure fonts are registered
    ensureFontsRegistered();

    const searchParams = request.nextUrl.searchParams;
    
    // Extract parameters
    const template = searchParams.get('template') as TemplateType | null;
    const name = searchParams.get('name');
    const date = searchParams.get('date');
    const time = searchParams.get('time');
    const station = searchParams.get('station');

    // Validate required parameters
    if (!template || !name || !date || !time) {
      return new NextResponse('Missing required parameters: template, name, date, time', {
        status: 400,
      });
    }

    // Validate template type
    if (!['EDDMTWR', 'EDDNTWR', 'APP', 'CTR'].includes(template)) {
      return new NextResponse(`Invalid template: ${template}. Must be one of: EDDMTWR, EDDNTWR, APP, CTR`, {
        status: 400,
      });
    }

    // Get template configuration
    const config = getTemplateConfig(template);
    
    // Check if station is required for this template
    if (config.requiresStation && !station) {
      return new NextResponse(`Station parameter is required for ${template} template`, {
        status: 400,
      });
    }

    // Create canvas
    const canvas = createCanvas(1920, 1080);
    const ctx = canvas.getContext('2d');

    // Try to load and draw template background
    const templatePath = join(process.cwd(), 'public', config.templatePath);
    try {
      const bgImage = await loadImage(templatePath);
      ctx.drawImage(bgImage, 0, 0, 1920, 1080);
    } catch {
      // Fallback: draw a gradient background if template doesn't exist
      const gradient = ctx.createLinearGradient(0, 0, 1920, 1080);
      if (config.fallbackGradient) {
        gradient.addColorStop(0, config.fallbackGradient.start);
        gradient.addColorStop(1, config.fallbackGradient.end);
      } else {
        gradient.addColorStop(0, "#134e4a");
        gradient.addColorStop(1, "#14b8a6");
      }
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 1920, 1080);
    }

    // Disable shadows
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Helper function to get the correct font family
    const getFontFamily = (configFont: string, isBold: boolean): string => {
      // If the config specifies MontserratBold or MontserratExtraBold, use it directly
      if (configFont === 'MontserratBold' || configFont === 'MontserratExtraBold') {
        return configFont;
      }
      
      // Otherwise, map based on bold flag
      return isBold ? 'MontserratBold' : 'MontserratExtraBold';
    };

    // Draw controller name
    if (name) {
      const nameConfig = config.name;
      ctx.fillStyle = nameConfig.style.color;
      ctx.textAlign = (nameConfig.position.align || "left") as CanvasTextAlign;
      
      // Use the font family from config or map it
      const fontFamily = getFontFamily(nameConfig.style.font, nameConfig.style.bold! || false);
      ctx.font = `${nameConfig.style.size-4}px ${fontFamily}`;
      
      const nameText = (nameConfig.prefix || "") + name;
      ctx.fillText(nameText, nameConfig.position.x, nameConfig.position.y);
    }

    // Draw weekday
    if (date) {
      const weekdayConfig = config.weekday;
      if (weekdayConfig.style.size > 0) {
        const dateObj = new Date(date);
        const weekdays = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
        const weekday = weekdays[dateObj.getDay()];
        
        ctx.fillStyle = weekdayConfig.style.color;
        ctx.textAlign = (weekdayConfig.position.align || "left") as CanvasTextAlign;
        
        const fontFamily = getFontFamily(weekdayConfig.style.font, weekdayConfig.style.bold! ||false);
        ctx.font = `${weekdayConfig.style.size-4}px ${fontFamily}`;
        
        ctx.fillText(weekday, weekdayConfig.position.x, weekdayConfig.position.y);
      }
    }

    // Draw date and time
    if (date || time) {
      const dateConfig = config.date;
      const timeConfig = config.time;
      
      let dateTimeText = "";
      
      if (date) {
        const dateObj = new Date(date);
        const day = String(dateObj.getDate()).padStart(2, '0');
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const year = dateObj.getFullYear();
        dateTimeText = `${day}.${month}.${year}`;
      }
      
      // Add time with separator
      if (time) {
        if (dateTimeText && timeConfig.separator) {
          dateTimeText += timeConfig.separator;
        }
        dateTimeText += `${time.replace(':', '')}z`;
      }
      
      if (dateTimeText) {
        ctx.fillStyle = dateConfig.style.color;
        ctx.textAlign = (dateConfig.position.align || "left") as CanvasTextAlign;
        
        const fontFamily = getFontFamily(dateConfig.style.font, dateConfig.style.bold! || false);
        ctx.font = `${dateConfig.style.size-4}px ${fontFamily}`;
        
        ctx.fillText(dateTimeText, dateConfig.position.x, dateConfig.position.y);
      }
    }

    // Draw station if provided and configured
    if (station && config.station) {
      const stationConfig = config.station;
      ctx.fillStyle = stationConfig.style.color;
      ctx.textAlign = (stationConfig.position.align || "left") as CanvasTextAlign;
      
      const fontFamily = getFontFamily(stationConfig.style.font, stationConfig.style.bold! || false);
      ctx.font = `${stationConfig.style.size-4}px ${fontFamily}`;
      
      ctx.fillText(station, stationConfig.position.x, stationConfig.position.y);
    }

    // Convert canvas to PNG buffer
    const buffer = canvas.toBuffer('image/png');

    // Return the image
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });

  } catch (error) {
    console.error('Error generating banner:', error);
    return new NextResponse(
      `Error generating banner: ${error instanceof Error ? error.message : 'Unknown error'}`,
      { status: 500 }
    );
  }
}