import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Product from '@/models/Product';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const user = getUserFromRequest(req);
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const supplierId = searchParams.get('supplierId');
    const query = supplierId ? { supplier: supplierId } : {};
    const products = await Product.find(query).populate('supplier', 'name businessName phone isActive').sort({ createdAt: -1 });
    return NextResponse.json({ products }, { status: 200 });
  } catch (error) {
    console.error('Fetch all products error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
