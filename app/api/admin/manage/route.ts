import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Admin from '@/models/Admin';
import bcrypt from 'bcryptjs';
import { getUserFromRequest } from '@/lib/auth';

// GET — list all admins
export async function GET(req: Request) {
  try {
    const user = getUserFromRequest(req);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const admins = await Admin.find({}).select('phone role createdAt').sort({ createdAt: -1 }).lean();
    return NextResponse.json({ admins, count: admins.length });
  } catch (error: any) {
    console.error('List admins error:', error.message);
    return NextResponse.json({ error: 'Failed to fetch admins' }, { status: 500 });
  }
}

// POST — add a new admin (Super Admin access)
export async function POST(req: Request) {
  try {
    const user = getUserFromRequest(req);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const { phone, password } = await req.json();

    if (!phone || !password) {
      return NextResponse.json({ error: 'Phone and password are required' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    // Check if admin already exists
    const existing = await Admin.findOne({ phone: phone.trim() });
    if (existing) {
      return NextResponse.json({ error: 'An admin with this phone already exists' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const admin = await Admin.create({ phone: phone.trim(), passwordHash, role: 'admin' });

    return NextResponse.json({
      message: 'Admin added successfully',
      admin: { id: admin._id, phone: admin.phone, role: admin.role },
    }, { status: 201 });
  } catch (error: any) {
    console.error('Add admin error:', error.message);
    return NextResponse.json({ error: 'Failed to add admin' }, { status: 500 });
  }
}

// DELETE — remove an admin
export async function DELETE(req: Request) {
  try {
    const user = getUserFromRequest(req);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const { searchParams } = new URL(req.url);
    const adminId = searchParams.get('id');

    if (!adminId) {
      return NextResponse.json({ error: 'Admin ID is required' }, { status: 400 });
    }

    // Prevent deleting yourself
    if (adminId === user.id) {
      return NextResponse.json({ error: 'You cannot remove yourself' }, { status: 400 });
    }

    // Prevent deleting the last admin
    const count = await Admin.countDocuments();
    if (count <= 1) {
      return NextResponse.json({ error: 'Cannot remove the last admin' }, { status: 400 });
    }

    const deleted = await Admin.findByIdAndDelete(adminId);
    if (!deleted) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Admin removed successfully' });
  } catch (error: any) {
    console.error('Remove admin error:', error.message);
    return NextResponse.json({ error: 'Failed to remove admin' }, { status: 500 });
  }
}
