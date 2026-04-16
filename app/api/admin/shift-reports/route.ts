import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import ShiftReport from '@/models/ShiftReport';
import SupplierOrder from '@/models/SupplierOrder';
import { getUserFromRequest } from '@/lib/auth';

// GET — fetch shift reports
export async function GET(req: Request) {
  try {
    await dbConnect();
    const user = getUserFromRequest(req);
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get('date');
    const filter: any = {};
    if (dateStr) {
      const date = new Date(dateStr);
      const start = new Date(date); start.setHours(0, 0, 0, 0);
      const end = new Date(date); end.setHours(23, 59, 59, 999);
      filter.shiftDate = { $gte: start, $lte: end };
    }

    const reports = await ShiftReport.find(filter).sort({ shiftDate: -1 }).limit(30).lean();
    return NextResponse.json({ reports });
  } catch (error: any) {
    console.error('ShiftReports GET error:', error.message);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

// POST — auto-generate shift report for today
export async function POST(req: Request) {
  try {
    await dbConnect();
    const user = getUserFromRequest(req);
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const shiftType = body.shiftType || 'full_day';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    // Aggregate today's orders
    const todayOrders = await SupplierOrder.find({
      createdAt: { $gte: today, $lte: endOfDay },
    }).lean();

    const received = todayOrders.length;
    const completed = todayOrders.filter((o: any) => ['delivered', 'completed'].includes(o.status)).length;
    const rejected = todayOrders.filter((o: any) => o.status === 'rejected').length;
    const cancelled = todayOrders.filter((o: any) => o.status === 'cancelled').length;
    const slaBreached = todayOrders.filter((o: any) => o.slaStatus === 'breached').length;
    const totalRevenue = todayOrders
      .filter((o: any) => ['delivered', 'completed'].includes(o.status))
      .reduce((sum: number, o: any) => sum + (o.supplierReply?.totalAmount || 0), 0);

    // Identify supplier issues
    const supplierIssues: any[] = [];
    const rejectedBySupplier = todayOrders.filter((o: any) => o.status === 'rejected');
    const supplierRejections: Record<string, { count: number; name: string; id: string }> = {};
    rejectedBySupplier.forEach((o: any) => {
      const key = o.supplierId?.toString();
      if (key) {
        if (!supplierRejections[key]) supplierRejections[key] = { count: 0, name: o.supplierName || 'Unknown', id: key };
        supplierRejections[key].count++;
      }
    });
    Object.values(supplierRejections).forEach(s => {
      if (s.count >= 2) supplierIssues.push({ supplierId: s.id, supplierName: s.name, issue: `Rejected ${s.count} orders today` });
    });

    const summary = `${received} orders received, ${completed} completed, ${rejected} rejected, ${cancelled} cancelled. ${slaBreached} SLA breaches. Revenue: ₹${totalRevenue.toLocaleString('en-IN')}.`;

    const report = await ShiftReport.create({
      shiftDate: today,
      shiftType,
      ordersReceived: received,
      ordersCompleted: completed,
      ordersRejected: rejected,
      ordersCancelled: cancelled,
      slaBreaches: slaBreached,
      exceptionsHandled: supplierIssues.length,
      totalRevenue,
      supplierIssues,
      summary,
      generatedBy: 'Admin',
    });

    return NextResponse.json({ success: true, report }, { status: 201 });
  } catch (error: any) {
    console.error('ShiftReports POST error:', error.message);
    return NextResponse.json({ error: 'Failed to generate' }, { status: 500 });
  }
}
