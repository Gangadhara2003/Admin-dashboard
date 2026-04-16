import { NextResponse } from 'next/server';
import admin from '@/lib/firebase';
import { getUserFromRequest } from '@/lib/auth';
import { getCache, setCache } from '@/lib/redis';

// GET — list Firebase Auth users (admin only)
export async function GET(req: Request) {
  try {
    const user = getUserFromRequest(req);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '1000');
    const nextPageToken = searchParams.get('nextPageToken') || undefined;

    // Check Redis cache first
    const cacheKey = `firebase-users:${limit}:${nextPageToken || 'first'}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    const listResult = await admin.auth().listUsers(limit, nextPageToken);

    const users = listResult.users.map((u) => ({
      uid: u.uid,
      phone: u.phoneNumber || null,
      email: u.email || null,
      displayName: u.displayName || null,
      photoURL: u.photoURL || null,
      disabled: u.disabled,
      emailVerified: u.emailVerified,
      createdAt: u.metadata.creationTime,
      lastSignIn: u.metadata.lastSignInTime,
      providerId: u.providerData?.[0]?.providerId || 'phone',
    }));

    const responseData = {
      users,
      total: users.length,
      nextPageToken: listResult.pageToken || null,
    };

    // Cache for 1 hour
    await setCache(cacheKey, responseData);

    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error('Firebase Users Error:', error.message);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}
