import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Supplier from '@/models/Supplier';
import { getUserFromRequest } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function GET(req: Request) {
  try {
    const user = getUserFromRequest(req);
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await dbConnect();
    const suppliers = await Supplier.find().select('-passwordHash').sort({ createdAt: -1 });
    return NextResponse.json({ suppliers }, { status: 200 });
  } catch (error) {
    console.error('Fetch suppliers error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = getUserFromRequest(req);
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await dbConnect();
    const body = await req.json();
    const { phone, password, name, businessName, email, address, city, state, pincode } = body;
    if (!phone || !password || !name || !businessName || !address) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    const existing = await Supplier.findOne({ phone });
    if (existing) return NextResponse.json({ error: 'Supplier with this phone number already exists' }, { status: 400 });
    const passwordHash = await bcrypt.hash(password, 10);
    const supplier = await Supplier.create({ phone, passwordHash, name, businessName, email, address, city, state, pincode });
    const supplierResponse = supplier.toObject();
    delete supplierResponse.passwordHash;
    return NextResponse.json({ message: 'Supplier created successfully', supplier: supplierResponse }, { status: 201 });
  } catch (error) {
    console.error('Create supplier error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
