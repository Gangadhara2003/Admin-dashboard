import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Admin from '@/models/Admin';
import bcrypt from 'bcryptjs';
import { getUserFromRequest } from '@/lib/auth';

// GET — get current admin profile
export async function GET(req: Request) {
  try {
    const user = getUserFromRequest(req);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const admin = await Admin.findById(user.id).select('phone role createdAt').lean();
    if (!admin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    return NextResponse.json({ admin });
  } catch (error: any) {
    console.error('Profile fetch error:', error.message);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

// PUT — update current admin profile (phone, password)
export async function PUT(req: Request) {
  try {
    const user = getUserFromRequest(req);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const { phone, currentPassword, newPassword } = await req.json();

    const admin = await Admin.findById(user.id);
    if (!admin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    // If changing password, verify current password
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json({ error: 'Current password is required' }, { status: 400 });
      }
      const isMatch = await bcrypt.compare(currentPassword, admin.passwordHash);
      if (!isMatch) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
      }
      if (newPassword.length < 6) {
        return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 });
      }
      admin.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    // If changing phone
    if (phone && phone !== admin.phone) {
      const existing = await Admin.findOne({ phone: phone.trim() });
      if (existing && existing._id.toString() !== admin._id.toString()) {
        return NextResponse.json({ error: 'This phone number is already used by another admin' }, { status: 409 });
      }
      admin.phone = phone.trim();
    }

    await admin.save();

    return NextResponse.json({
      message: 'Profile updated successfully',
      admin: { phone: admin.phone, role: admin.role },
    });
  } catch (error: any) {
    console.error('Profile update error:', error.message);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
