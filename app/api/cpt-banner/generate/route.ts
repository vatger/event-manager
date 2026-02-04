import { NextRequest, NextResponse } from 'next/server';
import satori from 'satori';
import sharp from 'sharp';
import { getTemplateConfig, type TemplateType } from '@/app/admin/edmm/cpt-banner/templateConfig';
import { readFile } from 'fs/promises';
import { join } from 'path';
import React from 'react';

/**
 * API Route: Generate CPT Banner Dynamically with Satori + Sharp
 * 
 * This endpoint generates a PNG banner image on-the-fly based on URL parameters.
 * Uses Satori for SVG generation and Sharp for PNG conversion.
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

// Cache fonts AND background images in memory
let fontCache: { bold: ArrayBuffer; extraBold: ArrayBuffer } | null = null;
let backgroundCache: Map<string, string> = new Map();

async function loadFonts() {
  if (fontCache) return fontCache;

  try {
    const publicDir = join(process.cwd(), 'public');
    const boldPath = join(publicDir, 'fonts', 'Montserrat-Bold.ttf');
    const extraBoldPath = join(publicDir, 'fonts', 'Montserrat-ExtraBold.ttf');

    const [bold, extraBold] = await Promise.all([
      readFile(boldPath),
      readFile(extraBoldPath),
    ]);

    fontCache = {
      bold: bold.buffer,
      extraBold: extraBold.buffer,
    };

    console.log('✅ Fonts loaded successfully');
    return fontCache;
  } catch (error) {
    console.error('❌ Error loading fonts:', error);
    throw error;
  }
}

async function loadBackgroundAsBase64(templatePath: string): Promise<string> {
  // Check cache first
  if (backgroundCache.has(templatePath)) {
    return backgroundCache.get(templatePath)!;
  }

  try {
    const publicDir = join(process.cwd(), 'public');
    const imagePath = join(publicDir, templatePath);
    
    // Read the image file
    const imageBuffer = await readFile(imagePath);
    
    // Convert to base64
    const base64 = imageBuffer.toString('base64');
    
    // Determine MIME type based on file extension
    const ext = templatePath.toLowerCase().split('.').pop();
    const mimeType = ext === 'png' ? 'image/png' : 
                     ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 
                     'image/png';
    
    const dataUrl = `data:${mimeType};base64,${base64}`;
    
    // Cache it
    backgroundCache.set(templatePath, dataUrl);
    
    console.log(`✅ Background loaded: ${templatePath}`);
    return dataUrl;
  } catch (error) {
    console.error(`❌ Error loading background ${templatePath}:`, error);
    throw error;
  }
}

export async function GET(request: NextRequest) {
  try {
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

    // Load fonts
    const fonts = await loadFonts();

    // Prepare weekday text
    let weekdayText = '';
    if (date && config.weekday.style.size > 0) {
      const dateObj = new Date(date);
      const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      weekdayText = weekdays[dateObj.getDay()];
    }

    // Prepare date/time text
    let dateTimeText = '';
    if (date) {
      const dateObj = new Date(date);
      const day = String(dateObj.getDate()).padStart(2, '0');
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const year = dateObj.getFullYear();
      dateTimeText = `${day}.${month}.${year}`;
    }
    if (time) {
      if (dateTimeText && config.time.separator) {
        dateTimeText += config.time.separator;
      }
      dateTimeText += `${time.replace(':', '')}z`;
    }

    // Helper function to get font weight
    const getFontWeight = (configFont: string, isBold: boolean): number => {
      if (configFont === 'MontserratExtraBold') return 800;
      if (configFont === 'MontserratBold') return 700;
      return isBold ? 700 : 800;
    };

    // Prepare background style - LOAD AS BASE64!
    let backgroundStyle: string;
    if (config.templatePath) {
      try {
        // Load background image as base64 data URL
        const base64Image = await loadBackgroundAsBase64(config.templatePath);
        backgroundStyle = `url(${base64Image})`;
      } catch (error) {
        console.error('Failed to load background, using gradient fallback:', error);
        // Fallback to gradient if image loading fails
        const startColor = config.fallbackGradient?.start || '#134e4a';
        const endColor = config.fallbackGradient?.end || '#14b8a6';
        backgroundStyle = `linear-gradient(to bottom right, ${startColor}, ${endColor})`;
      }
    } else {
      const startColor = config.fallbackGradient?.start || '#134e4a';
      const endColor = config.fallbackGradient?.end || '#14b8a6';
      backgroundStyle = `linear-gradient(to bottom right, ${startColor}, ${endColor})`;
    }

    // Build children elements
    const children: React.ReactNode[] = [];

    // Controller Name
    if (name) {
      children.push(
        React.createElement('div', {
          key: 'name',
          style: {
            position: 'absolute',
            left: `${config.name.position.x}px`,
            top: `${config.name.position.y - config.name.style.size + 4}px`,
            color: config.name.style.color,
            fontSize: `${config.name.style.size - 4}px`,
            fontWeight: getFontWeight(config.name.style.font, config.name.style.bold || false),
            textAlign: config.name.position.align || 'left',
            display: 'flex',
          },
        }, (config.name.prefix || '') + name)
      );
    }

    // Weekday
    if (weekdayText) {
      children.push(
        React.createElement('div', {
          key: 'weekday',
          style: {
            position: 'absolute',
            left: `${config.weekday.position.x}px`,
            top: `${config.weekday.position.y - config.weekday.style.size}px`,
            color: config.weekday.style.color,
            fontSize: `${config.weekday.style.size}px`,
            fontWeight: getFontWeight(config.weekday.style.font, config.weekday.style.bold || false),
            textAlign: config.weekday.position.align || 'left',
            display: 'flex',
          },
        }, weekdayText)
      );
    }

    // Date/Time
    if (dateTimeText) {
      children.push(
        React.createElement('div', {
          key: 'datetime',
          style: {
            position: 'absolute',
            left: `${config.date.position.x}px`,
            top: `${config.date.position.y - config.date.style.size}px`,
            color: config.date.style.color,
            fontSize: `${config.date.style.size}px`,
            fontWeight: getFontWeight(config.date.style.font, config.date.style.bold || false),
            textAlign: config.date.position.align || 'left',
            display: 'flex',
          },
        }, dateTimeText)
      );
    }

    // Station
    if (station && config.station) {
      children.push(
        React.createElement('div', {
          key: 'station',
          style: {
            position: 'absolute',
            left: `${config.station.position.x}px`,
            top: `${config.station.position.y - config.station.style.size}px`,
            color: config.station.style.color,
            fontSize: `${config.station.style.size}px`,
            fontWeight: getFontWeight(config.station.style.font, config.station.style.bold || false),
            textAlign: config.station.position.align || 'left',
            display: 'flex',
          },
        }, station)
      );
    }

    // Build the SVG using Satori
    const svg = await satori(
      React.createElement('div', {
        style: {
          width: '1920px',
          height: '1080px',
          display: 'flex',
          position: 'relative',
          backgroundImage: backgroundStyle,
          backgroundSize: 'cover',
          fontFamily: 'Montserrat',
        },
      }, children),
      {
        width: 1920,
        height: 1080,
        fonts: [
          {
            name: 'Montserrat',
            data: fonts.bold,
            weight: 700,
            style: 'normal',
          },
          {
            name: 'Montserrat',
            data: fonts.extraBold,
            weight: 800,
            style: 'normal',
          },
        ],
      }
    );

    // Convert SVG to PNG using sharp
    const pngBuffer = await sharp(Buffer.from(svg))
      .png()
      .toBuffer();

    // Return the PNG image
    return new NextResponse(new Uint8Array(pngBuffer), {
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