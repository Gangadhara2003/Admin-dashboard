import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import ChatMessage from '@/models/ChatMessage';
import Notification from '@/models/Notification';
import { getUserFromRequest } from '@/lib/auth';
import { sendChatNotificationEmail } from '@/lib/email';

// GET — fetch chat messages between a supplier and admin, or unread counts
export async function GET(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const supplierId = searchParams.get('supplierId');

    // Return unread counts per supplier for the admin sidebar
    if (searchParams.get('unreadCounts') === 'true') {
      const counts = await ChatMessage.aggregate([
        { $match: { senderRole: 'supplier', readByAdmin: { $ne: true } } },
        { $group: { _id: '$supplierId', count: { $sum: 1 } } },
      ]);
      const unread: Record<string, number> = {};
      counts.forEach((c: any) => { unread[c._id.toString()] = c.count; });
      return NextResponse.json({ unread });
    }

    if (!supplierId) {
      return NextResponse.json({ error: 'supplierId is required' }, { status: 400 });
    }

    const messages = await ChatMessage.find({ supplierId })
      .sort({ createdAt: 1 })
      .limit(200)
      .lean();

    // Mark supplier messages as read by admin
    const user = getUserFromRequest(req);
    if (user?.role === 'admin') {
      await ChatMessage.updateMany(
        { supplierId, senderRole: 'supplier', readByAdmin: { $ne: true } },
        { $set: { readByAdmin: true } }
      );
    }

    return NextResponse.json({ messages });
  } catch (error: any) {
    console.error('Chat GET Error:', error.message);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

// POST — send a chat message
export async function POST(req: Request) {
  try {
    await dbConnect();
    const user = getUserFromRequest(req);
    const body = await req.json();

    const senderRole = user?.role === 'admin' ? 'admin' : 'supplier';
    const supplierId = body.supplierId;

    if (!supplierId || !body.message?.trim()) {
      return NextResponse.json({ error: 'supplierId and message are required' }, { status: 400 });
    }

    const chatMessage = await ChatMessage.create({
      supplierId,
      senderRole,
      message: body.message.trim(),
    });

    // Notify the other party
    if (senderRole === 'supplier') {
      // Supplier sent → notify admin
      await Notification.create({
        type: 'support_message',
        title: `Message from ${body.supplierName || 'Supplier'}`,
        message: body.message.trim().substring(0, 100),
        from: supplierId,
        fromName: body.supplierName || 'Supplier',
        to: 'admin',
        link: `/admin/support?supplierId=${supplierId}`,
      });

      // Email admin
      sendChatNotificationEmail(
        body.supplierName || 'Supplier',
        body.message.trim()
      ).catch(err => console.error('Chat email failed:', err));
    } else {
      // Admin sent → notify supplier
      await Notification.create({
        type: 'support_message',
        title: 'Message from Admin',
        message: body.message.trim().substring(0, 100),
        to: supplierId,
        link: '/supplier/support',
      });
    }

    return NextResponse.json({ success: true, message: chatMessage }, { status: 201 });
  } catch (error: any) {
    console.error('Chat POST Error:', error.message);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
