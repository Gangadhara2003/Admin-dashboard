import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Notification from '@/models/Notification';
import { getUserFromRequest } from '@/lib/auth';

// GET — fetch notifications (admin sees all to:'admin'; supplier sees their own)
export async function GET(req: Request) {
  try {
    await dbConnect();
    const user = getUserFromRequest(req);
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const unreadOnly = searchParams.get('unread') === 'true';

    const filter: any = {};
    if (user?.role === 'admin') {
      filter.to = 'admin';
    } else if (user?.id) {
      filter.to = user.id;
    } else {
      // Fallback: show admin notifications
      filter.to = 'admin';
    }
    if (unreadOnly) filter.isRead = false;

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const unreadCount = await Notification.countDocuments({ ...filter, isRead: false });

    return NextResponse.json({ notifications, unreadCount });
  } catch (error: any) {
    console.error('Notifications GET Error:', error.message);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}

// POST — create a notification
export async function POST(req: Request) {
  try {
    await dbConnect();
    const body = await req.json();

    const notification = await Notification.create({
      type: body.type,
      title: body.title,
      message: body.message,
      data: body.data || {},
      from: body.from || null,
      fromName: body.fromName || '',
      to: body.to || 'admin',
      link: body.link || '',
      isRead: false,
    });

    return NextResponse.json({ success: true, notification }, { status: 201 });
  } catch (error: any) {
    console.error('Notifications POST Error:', error.message);
    return NextResponse.json({ error: 'Failed to create notification' }, { status: 500 });
  }
}

// PUT — mark notifications as read
export async function PUT(req: Request) {
  try {
    await dbConnect();
    const body = await req.json();

    if (body.markAllRead) {
      const filter: any = { to: body.to || 'admin' };
      await Notification.updateMany(filter, { isRead: true });
    } else if (body.id) {
      await Notification.findByIdAndUpdate(body.id, { isRead: true });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Notifications PUT Error:', error.message);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}
