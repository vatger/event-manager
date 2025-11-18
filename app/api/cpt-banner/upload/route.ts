import { NextRequest, NextResponse } from 'next/server';

/**
 * API Route: Upload CPT Banner to NextCloud
 * 
 * This endpoint receives a banner image (as base64 or blob) and uploads it to NextCloud DMS.
 * 
 * Required Environment Variables:
 * - NEXTCLOUD_URL: NextCloud instance URL (e.g., https://dms.vatsim-germany.org)
 * - NEXTCLOUD_USERNAME: NextCloud username for authentication
 * - NEXTCLOUD_PASSWORD: NextCloud app password
 * - NEXTCLOUD_UPLOAD_PATH: Target folder path (e.g., /Event_all/EDMM/CPT Banner)
 */

export async function POST(request: NextRequest) {
  try {
    // Check if NextCloud credentials are configured
    const nextcloudUrl = process.env.NEXTCLOUD_URL;
    const nextcloudUsername = process.env.NEXTCLOUD_USERNAME;
    const nextcloudPassword = process.env.NEXTCLOUD_PASSWORD;
    const uploadPath = process.env.NEXTCLOUD_UPLOAD_PATH || '/Event_all/EDMM/CPT Banner';

    if (!nextcloudUrl || !nextcloudUsername || !nextcloudPassword) {
      return NextResponse.json(
        { 
          error: 'NextCloud credentials not configured',
          message: 'Please configure NEXTCLOUD_URL, NEXTCLOUD_USERNAME, and NEXTCLOUD_PASSWORD environment variables'
        },
        { status: 500 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { imageData, fileName } = body;

    if (!imageData || !fileName) {
      return NextResponse.json(
        { error: 'Missing required fields: imageData and fileName' },
        { status: 400 }
      );
    }

    // Convert base64 to buffer
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Construct WebDAV URL
    // NextCloud WebDAV endpoint: /remote.php/dav/files/{username}/{path}
    const webdavPath = `/remote.php/dav/files/${nextcloudUsername}${uploadPath}/${fileName}`;
    const uploadUrl = `${nextcloudUrl}${webdavPath}`;

    // Upload to NextCloud using WebDAV
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${nextcloudUsername}:${nextcloudPassword}`).toString('base64'),
        'Content-Type': 'image/png',
      },
      body: buffer,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('NextCloud upload failed:', errorText);
      return NextResponse.json(
        { 
          error: 'Failed to upload to NextCloud',
          details: errorText,
          status: uploadResponse.status
        },
        { status: uploadResponse.status }
      );
    }

    // Generate public share link
    // We'll use NextCloud's sharing API to create a public link
    const shareApiUrl = `${nextcloudUrl}/ocs/v2.php/apps/files_sharing/api/v1/shares`;
    const sharePath = `${uploadPath}/${fileName}`;

    const shareResponse = await fetch(shareApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${nextcloudUsername}:${nextcloudPassword}`).toString('base64'),
        'OCS-APIRequest': 'true',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        path: sharePath,
        shareType: '3', // Public link
        permissions: '1', // Read-only
      }),
    });

    if (!shareResponse.ok) {
      const errorText = await shareResponse.text();
      console.error('Failed to create share link:', errorText);
      
      // If sharing fails, at least return the direct WebDAV link
      const directLink = `${nextcloudUrl}/remote.php/webdav${uploadPath}/${fileName}`;
      return NextResponse.json({
        success: true,
        message: 'File uploaded but public share link creation failed',
        directLink,
        fileName,
      });
    }

    const shareData = await shareResponse.json();
    
    // Extract the share URL from the response
    let shareUrl = shareData?.ocs?.data?.url;
    
    if (shareUrl) {
      // Convert share URL to direct download/preview link
      // NextCloud share links look like: https://dms.example.com/s/{token}
      // Direct image links are: https://dms.example.com/s/{token}/download
      const directImageUrl = `${shareUrl}/download`;
      
      return NextResponse.json({
        success: true,
        message: 'Banner uploaded successfully',
        shareUrl: directImageUrl,
        fileName,
      });
    } else {
      // Fallback to direct WebDAV link
      const directLink = `${nextcloudUrl}/remote.php/webdav${uploadPath}/${fileName}`;
      return NextResponse.json({
        success: true,
        message: 'File uploaded successfully',
        directLink,
        fileName,
      });
    }

  } catch (error) {
    console.error('Error uploading to NextCloud:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
