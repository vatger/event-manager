import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { userhasAdminAcess } from '@/lib/acl/permissions';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user || !(await userhasAdminAcess(Number(session.user.id)))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const bearerToken = process.env.TRAINING_API_TOKEN;
    const trainingCPTURL = process.env.TRAINING_API_CPTS_URL;

    if (!bearerToken || !trainingCPTURL) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const response = await fetch(trainingCPTURL, {
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'Content-Type': 'application/json',
      },
      next: { revalidate: 60 }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch CPT data');
    }

    const data = await response.json();

    return NextResponse.json(data);

  } catch (error) {
    console.error('CPT API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch CPT data' }, 
      { status: 500 }
    );
  }
}