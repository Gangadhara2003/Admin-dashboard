import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Admin from '@/models/Admin';
import bcrypt from 'bcryptjs';

export async function POST() {
  try {
    await dbConnect();
    const count = await Admin.countDocuments();
    if (count > 0) return NextResponse.json({ message: 'Admins already seeded' }, { status: 400 });
    const passwordHash = await bcrypt.hash('Vcniti-supply-2026', 10);
    const admins = [{ phone: '9686231591', passwordHash }, { phone: '9480537969', passwordHash }];
    await Admin.insertMany(admins);
    return NextResponse.json({ message: 'Admins seeded successfully' }, { status: 201 });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: 'Failed to seed admins' }, { status: 500 });
  }
}
