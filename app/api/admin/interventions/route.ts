import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import SupplierOrder from '@/models/SupplierOrder';
import Notification from '@/models/Notification';
import Supplier from '@/models/Supplier';
import { getUserFromRequest } from '@/lib/auth';

// GET — fetch escalation log for an order
export async function GET(req: Request) {
  try {
    await dbConnect();
    const user = getUserFromRequest(req);
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get('orderId');
    if (orderId) {
      const order = await SupplierOrder.findById(orderId).select('escalationLog supplierName shopifyOrderRef status').lean();
      return NextResponse.json({ escalationLog: (order as any)?.escalationLog || [] });
    }

    // All orders with escalations
    const orders = await SupplierOrder.find({ 'escalationLog.0': { $exists: true } })
      .sort({ updatedAt: -1 }).limit(50).lean();
    return NextResponse.json({ orders });
  } catch (error: any) {
    console.error('Interventions GET error:', error.message);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

// POST — perform intervention action
export async function POST(req: Request) {
  try {
    await dbConnect();
    const user = getUserFromRequest(req);
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { orderId, action, reason, newSupplierId } = body;

    if (!orderId || !action) return NextResponse.json({ error: 'orderId and action required' }, { status: 400 });

    const order = await SupplierOrder.findById(orderId);
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    if (!order.escalationLog) order.escalationLog = [];

    if (action === 'reassign_supplier') {
      if (!newSupplierId) return NextResponse.json({ error: 'newSupplierId required' }, { status: 400 });
      const newSupplier = await Supplier.findById(newSupplierId);
      if (!newSupplier) return NextResponse.json({ error: 'New supplier not found' }, { status: 404 });

      const prevSupplierId = order.supplierId;
      order.escalationLog.push({
        action: 'reassign_supplier',
        reason: reason || '',
        performedBy: 'Admin',
        previousSupplierId: prevSupplierId,
        newSupplierId,
        timestamp: new Date(),
      });

      // Notify old supplier
      await Notification.create({
        type: 'order_cancelled',
        title: 'Order Reassigned',
        message: `Order ${order.shopifyOrderRef || ''} has been reassigned to another supplier. Reason: ${reason || 'Admin decision'}`,
        to: prevSupplierId.toString(),
        link: '/supplier/orders',
      });

      // Update order
      order.supplierId = newSupplierId;
      order.supplierName = newSupplier.name;
      order.status = 'pending';
      if (!order.timeline) order.timeline = [];
      order.timeline.push({ status: 'pending', changedBy: 'Admin', timestamp: new Date(), note: `Reassigned to ${newSupplier.name}. ${reason || ''}` });
      await order.save();

      // Notify new supplier
      await Notification.create({
        type: 'order_assigned',
        title: 'New Order Assigned',
        message: `Admin reassigned an order with ${order.items?.length || 0} item(s) to you.`,
        to: newSupplierId,
        link: '/supplier/orders',
      });

      return NextResponse.json({ success: true, order });

    } else if (action === 'request_refund') {
      order.refundStatus = 'requested';
      order.refundNote = reason || '';
      order.escalationLog.push({ action: 'mark_resolved', reason: `Refund requested: ${reason || ''}`, performedBy: 'Admin', timestamp: new Date() });
      if (!order.timeline) order.timeline = [];
      order.timeline.push({ status: 'refund_requested', changedBy: 'Admin', timestamp: new Date(), note: reason || 'Refund requested' });
      await order.save();

      await Notification.create({
        type: 'order_cancelled',
        title: 'Refund Requested',
        message: `Admin requested a refund for order ${order.shopifyOrderRef || ''}. ${reason || ''}`,
        to: 'admin',
        link: '/admin/finance',
      });

      return NextResponse.json({ success: true, order });

    } else if (action === 'send_customer_feedback') {
      const { feedback } = body;
      order.customerFeedback = feedback;
      order.escalationLog.push({ action: 'call_customer', reason: `Customer feedback: ${feedback || ''}`, performedBy: 'Admin', timestamp: new Date() });
      if (!order.timeline) order.timeline = [];
      order.timeline.push({ status: order.status, changedBy: 'Admin', timestamp: new Date(), note: `Customer feedback shared: ${feedback}` });
      await order.save();

      // Notify supplier about customer feedback
      await Notification.create({
        type: 'order_response',
        title: 'Customer Feedback',
        message: `Admin shared customer feedback for order ${order.shopifyOrderRef || ''}: "${feedback}"`,
        to: order.supplierId.toString(),
        link: '/supplier/orders',
      });

      return NextResponse.json({ success: true, order });

    } else if (action === 'mark_resolved') {
      order.escalationLog.push({ action: 'mark_resolved', reason: reason || '', performedBy: 'Admin', timestamp: new Date() });
      if (!order.timeline) order.timeline = [];
      order.timeline.push({ status: order.status, changedBy: 'Admin', timestamp: new Date(), note: `Resolved: ${reason || ''}` });
      await order.save();
      return NextResponse.json({ success: true, order });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Interventions POST error:', error.message);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
