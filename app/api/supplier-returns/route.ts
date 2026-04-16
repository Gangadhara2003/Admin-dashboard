import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import SupplierReturn from '@/models/SupplierReturn';
import SupplierOrder from '@/models/SupplierOrder';
import Notification from '@/models/Notification';
import { getUserFromRequest } from '@/lib/auth';

// GET — fetch returns
export async function GET(req: Request) {
  try {
    await dbConnect();
    const user = getUserFromRequest(req);
    const { searchParams } = new URL(req.url);

    let filter: any = {};
    if (user?.role === 'supplier' && user?.id) {
      filter.supplierId = user.id;
    } else if (searchParams.get('supplierId')) {
      filter.supplierId = searchParams.get('supplierId');
    }
    if (searchParams.get('status')) {
      filter.status = searchParams.get('status');
    }

    const returns = await SupplierReturn.find(filter).sort({ createdAt: -1 }).limit(200).lean();
    return NextResponse.json({ returns });
  } catch (error: any) {
    console.error('SupplierReturns GET Error:', error.message);
    return NextResponse.json({ error: 'Failed to fetch returns' }, { status: 500 });
  }
}

// POST — admin creates a return request
export async function POST(req: Request) {
  try {
    await dbConnect();
    const user = getUserFromRequest(req);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized — admin only' }, { status: 401 });
    }

    const body = await req.json();
    if (!body.orderId || !body.reason) {
      return NextResponse.json({ error: 'orderId and reason are required' }, { status: 400 });
    }

    const order = await SupplierOrder.findById(body.orderId);
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const returnReq = await SupplierReturn.create({
      orderId: body.orderId,
      supplierId: order.supplierId,
      supplierName: order.supplierName,
      items: body.items || order.items,
      reason: body.reason,
      adminNote: body.adminNote || '',
      shopifyOrderRef: order.shopifyOrderRef,
      status: 'requested',
    });

    await Notification.create({
      type: 'return_request',
      title: 'Return Request Created',
      message: `Admin has initiated a return for your order. Reason: ${body.reason}`,
      to: order.supplierId.toString(),
      link: '/supplier/returns',
      data: { returnId: returnReq._id, orderId: body.orderId },
    });

    return NextResponse.json({ success: true, return: returnReq }, { status: 201 });
  } catch (error: any) {
    console.error('SupplierReturns POST Error:', error.message);
    return NextResponse.json({ error: 'Failed to create return' }, { status: 500 });
  }
}

// PUT — update return status
export async function PUT(req: Request) {
  try {
    await dbConnect();
    const user = getUserFromRequest(req);
    const body = await req.json();
    const { returnId, action } = body;

    if (!returnId) {
      return NextResponse.json({ error: 'returnId is required' }, { status: 400 });
    }

    const returnReq = await SupplierReturn.findById(returnId);
    if (!returnReq) {
      return NextResponse.json({ error: 'Return not found' }, { status: 404 });
    }

    if (action === 'approve') {
      returnReq.status = 'approved';
      if (body.adminNote) returnReq.adminNote = body.adminNote;
      await returnReq.save();

      await Notification.create({
        type: 'return_request',
        title: 'Return Approved',
        message: `Your return request has been approved.`,
        to: returnReq.supplierId.toString(),
        link: '/supplier/returns',
      });
    } else if (action === 'dispute') {
      returnReq.status = 'disputed';
      if (body.supplierNote) returnReq.supplierNote = body.supplierNote;
      await returnReq.save();

      await Notification.create({
        type: 'return_request',
        title: 'Return Disputed',
        message: `${returnReq.supplierName || 'Supplier'} has disputed the return request. ${body.supplierNote || ''}`,
        to: 'admin',
        link: '/admin/returns',
      });
    } else if (action === 'picked_up') {
      returnReq.status = 'picked_up';
      await returnReq.save();
    } else if (action === 'refunded') {
      returnReq.status = 'refunded';
      await returnReq.save();

      await Notification.create({
        type: 'return_request',
        title: 'Return Refunded',
        message: `Return has been refunded for your order.`,
        to: returnReq.supplierId.toString(),
        link: '/supplier/returns',
      });
    }

    return NextResponse.json({ success: true, return: returnReq });
  } catch (error: any) {
    console.error('SupplierReturns PUT Error:', error.message);
    return NextResponse.json({ error: 'Failed to update return' }, { status: 500 });
  }
}
