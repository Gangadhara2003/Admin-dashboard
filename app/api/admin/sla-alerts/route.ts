import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import SupplierOrder from '@/models/SupplierOrder';
import Notification from '@/models/Notification';
import { getUserFromRequest } from '@/lib/auth';

const SLA_THRESHOLD_HOURS = 3.5;

// GET — returns all orders that have crossed 3.5 hours without delivery
export async function GET(req: Request) {
  try {
    await dbConnect();
    const user = getUserFromRequest(req);
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const thresholdMs = SLA_THRESHOLD_HOURS * 60 * 60 * 1000;
    const thresholdTime = new Date(Date.now() - thresholdMs);

    // Find orders assigned before threshold and not yet delivered/completed/cancelled
    const breachedOrders = await SupplierOrder.find({
      createdAt: { $lte: thresholdTime },
      status: { $in: ['pending', 'accepted', 'delivery_boy_coming', 'given_to_delivery', 'in_transit'] },
    }).sort({ createdAt: 1 }).lean();

    // Also update their SLA status
    const orderIds = breachedOrders.map((o: any) => o._id);
    if (orderIds.length > 0) {
      await SupplierOrder.updateMany(
        { _id: { $in: orderIds }, slaStatus: { $ne: 'breached' } },
        { $set: { slaStatus: 'breached', slaBreachedAt: new Date() } }
      );
    }

    // Warning orders (between 2.5 and 3.5 hours)
    const warningMs = 2.5 * 60 * 60 * 1000;
    const warningTime = new Date(Date.now() - warningMs);
    const warningOrders = await SupplierOrder.find({
      createdAt: { $lte: warningTime, $gt: thresholdTime },
      status: { $in: ['pending', 'accepted', 'delivery_boy_coming', 'given_to_delivery', 'in_transit'] },
    }).sort({ createdAt: 1 }).lean();

    // Calculate elapsed time for each
    const enriched = breachedOrders.map((o: any) => ({
      ...o,
      elapsedMinutes: Math.round((Date.now() - new Date(o.createdAt).getTime()) / 60000),
      elapsedHours: ((Date.now() - new Date(o.createdAt).getTime()) / 3600000).toFixed(1),
      severity: 'breached',
    }));

    const enrichedWarning = warningOrders.map((o: any) => ({
      ...o,
      elapsedMinutes: Math.round((Date.now() - new Date(o.createdAt).getTime()) / 60000),
      elapsedHours: ((Date.now() - new Date(o.createdAt).getTime()) / 3600000).toFixed(1),
      severity: 'warning',
    }));

    return NextResponse.json({
      breached: enriched,
      warning: enrichedWarning,
      totalBreached: enriched.length,
      totalWarning: enrichedWarning.length,
      thresholdHours: SLA_THRESHOLD_HOURS,
    });
  } catch (error: any) {
    console.error('SLA alerts GET error:', error.message);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}
