import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Admin from '@/models/Admin';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const decoded = getUserFromRequest(req);
    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    await dbConnect();
    const admin = await Admin.findById(decoded.id).select('phone role').lean();
    if (!admin) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    return NextResponse.json({
      user: { id: admin._id.toString(), phone: admin.phone, role: 'admin', name: 'Admin' },
    });
  } catch {
    return NextResponse.json({ user: null }, { status: 500 });
  }
}
