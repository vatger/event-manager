import { NextRequest, NextResponse } from 'next/server';
import { getTemplateConfig, type TemplateType } from '@/app/admin/cpt-banner/templateConfig';

/**
 * API Route: Generate CPT Banner Dynamically
 * 
 * This endpoint generates a banner image on-the-fly based on URL parameters.
 * No file storage needed - banners are generated on each request.
 * 
 * Query Parameters:
 * - template: Template type (TWR, APP, CTR)
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

    // Get template configuration
    const config = getTemplateConfig(template);
    
    // Check if station is required for this template
    if (config.requiresStation && !station) {
      return new NextResponse(`Station parameter is required for ${template} template`, {
        status: 400,
      });
    }

    // For now, return a simple response indicating the banner would be generated
    // In production, this would use canvas or similar to generate the actual image
    return new NextResponse(
      JSON.stringify({
        message: 'Banner generation endpoint',
        parameters: { template, name, date, time, station },
        note: 'Canvas-based image generation will be implemented',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error generating banner:', error);
    return new NextResponse(
      `Error generating banner: ${error instanceof Error ? error.message : 'Unknown error'}`,
      { status: 500 }
    );
  }
}
