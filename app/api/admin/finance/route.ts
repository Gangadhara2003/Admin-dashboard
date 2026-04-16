import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import SupplierOrder from '@/models/SupplierOrder';
import { getUserFromRequest } from '@/lib/auth';

// GET — finance dashboard data
export async function GET(req: Request) {
  try {
    await dbConnect();
    const user = getUserFromRequest(req);
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period') || 'daily';
    const customStart = searchParams.get('startDate');
    const customEnd = searchParams.get('endDate');

    const now = new Date();
    let startDate: Date;
    let endDate: Date | undefined;

    if (customStart) {
      // Custom date range overrides period
      startDate = new Date(customStart);
      startDate.setHours(0, 0, 0, 0);
      if (customEnd) {
        endDate = new Date(customEnd);
        endDate.setHours(23, 59, 59, 999);
      }
    } else if (period === 'weekly') {
      startDate = new Date(now); startDate.setDate(now.getDate() - 7);
    } else if (period === 'monthly') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      startDate = new Date(now); startDate.setHours(0, 0, 0, 0);
    }

    const dateFilter: any = { $gte: startDate };
    if (endDate) dateFilter.$lte = endDate;

    const orders = await SupplierOrder.find({
      createdAt: dateFilter,
      status: { $nin: ['cancelled'] },
    }).lean();

    const completedOrders = orders.filter((o: any) => ['delivered', 'completed'].includes(o.status));
    const gmv = completedOrders.reduce((sum: number, o: any) => sum + (o.supplierReply?.totalAmount || 0), 0);
    const paidOrders = orders.filter((o: any) => o.paymentStatus === 'paid');
    const supplierPayouts = paidOrders.reduce((sum: number, o: any) => sum + (o.paidAmount || 0), 0);
    const pendingPayouts = orders
      .filter((o: any) => o.paymentStatus !== 'paid' && o.supplierReply?.totalAmount)
      .reduce((sum: number, o: any) => sum + (o.supplierReply?.totalAmount || 0), 0);
    const refunds = orders
      .filter((o: any) => o.refundStatus && o.refundStatus !== 'none')
      .reduce((sum: number, o: any) => sum + (o.refundAmount || 0), 0);

    // Supplier-wise breakdown
    const supplierMap: Record<string, { name: string; orders: number; amount: number; paid: number }> = {};
    orders.forEach((o: any) => {
      const key = o.supplierId?.toString() || 'unknown';
      if (!supplierMap[key]) supplierMap[key] = { name: o.supplierName || 'Unknown', orders: 0, amount: 0, paid: 0 };
      supplierMap[key].orders++;
      supplierMap[key].amount += o.supplierReply?.totalAmount || 0;
      if (o.paymentStatus === 'paid') supplierMap[key].paid += o.paidAmount || 0;
    });

    return NextResponse.json({
      period,
      startDate,
      kpis: {
        totalOrders: orders.length,
        completedOrders: completedOrders.length,
        gmv,
        supplierPayouts,
        pendingPayouts,
        refunds,
      },
      supplierBreakdown: Object.entries(supplierMap).map(([id, data]) => ({ supplierId: id, ...data })),
    });
  } catch (error: any) {
    console.error('Finance GET error:', error.message);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}
