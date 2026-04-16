import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import SupplierOrder from '@/models/SupplierOrder';
import SupplierProduct from '@/models/SupplierProduct';
import Supplier from '@/models/Supplier';
import Notification from '@/models/Notification';
import { getUserFromRequest } from '@/lib/auth';
import { sendOrderAssignedEmail, sendOrderStatusEmail, sendSupplierNotificationEmail } from '@/lib/email';
import { getCache, setCache, invalidateCachePattern, CACHE_KEYS } from '@/lib/redis';

// Helper: fuzzy match product name
function fuzzyMatch(itemName: string, productName: string): boolean {
  const a = itemName.toLowerCase().trim();
  const b = productName.toLowerCase().trim();
  if (a.includes(b) || b.includes(a)) return true;
  return a.split(/\s+/).filter(w => w.length > 2).some(w =>
    b.split(/\s+/).some(pw => pw.includes(w) || w.includes(pw))
  );
}

// Helper: push timeline entry
function pushTimeline(order: any, status: string, changedBy: string, note?: string) {
  if (!order.timeline) order.timeline = [];
  order.timeline.push({ status, changedBy, timestamp: new Date(), note: note || '' });
}

// GET — fetch supplier orders with server-side pagination
export async function GET(req: Request) {
  try {
    await dbConnect();
    const user = getUserFromRequest(req);
    const { searchParams } = new URL(req.url);

    // Check Redis cache first
    const cacheKey = CACHE_KEYS.SUPPLIER_ORDERS(searchParams.toString() || 'all');
    const cached = await getCache(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    let filter: any = {};
    if (user?.role === 'supplier' && user?.id) {
      filter.supplierId = user.id;
    } else if (searchParams.get('supplierId')) {
      filter.supplierId = searchParams.get('supplierId');
    }
    if (searchParams.get('status')) {
      filter.status = searchParams.get('status');
    }
    if (searchParams.get('gstRequested') === 'true') {
      filter.gstInvoiceRequested = true;
    }
    if (searchParams.get('search')) {
      const s = searchParams.get('search')!;
      filter.$or = [
        { shopifyOrderRef: { $regex: s, $options: 'i' } },
        { supplierName: { $regex: s, $options: 'i' } },
      ];
    }

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      SupplierOrder.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      SupplierOrder.countDocuments(filter),
    ]);

    const responseData = { orders, total, page, limit, totalPages: Math.ceil(total / limit) };

    // Cache for 1 hour
    await setCache(cacheKey, responseData);

    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error('SupplierOrders GET Error:', error.message);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

// POST — admin assigns an order to a supplier
export async function POST(req: Request) {
  try {
    await dbConnect();
    const user = getUserFromRequest(req);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized — admin only' }, { status: 401 });
    }

    const body = await req.json();
    if (!body.supplierId || !body.items?.length) {
      return NextResponse.json({ error: 'supplierId and items are required' }, { status: 400 });
    }

    // Duplicate order prevention
    if (body.shopifyOrderRef) {
      const existing = await SupplierOrder.findOne({
        shopifyOrderRef: body.shopifyOrderRef,
        supplierId: body.supplierId,
        status: { $nin: ['cancelled', 'rejected'] },
      });
      if (existing) {
        return NextResponse.json({
          error: `This order (${body.shopifyOrderRef}) is already assigned to ${body.supplierName || 'this supplier'}.`,
          duplicate: true,
        }, { status: 409 });
      }
    }

    const order = await SupplierOrder.create({
      supplierId: body.supplierId,
      supplierName: body.supplierName || '',
      items: body.items,
      shopifyOrderRef: body.shopifyOrderRef || '',
      status: 'pending',
      timeline: [{ status: 'pending', changedBy: 'Admin', timestamp: new Date(), note: 'Order assigned to supplier' }],
    });

    // Notify supplier
    await Notification.create({
      type: 'order_assigned',
      title: 'New Order Assigned',
      message: `Admin assigned an order with ${body.items.length} item(s). Please review and respond.`,
      to: body.supplierId,
      link: '/supplier/orders',
      data: { orderId: order._id },
    });

    // Reduce supplier product quantities
    try {
      const supplierProducts = await SupplierProduct.find({
        supplierId: body.supplierId,
        status: 'approved',
      });

      for (const item of body.items) {
        const match = supplierProducts.find((sp: any) => {
          const spName = sp.source === 'catalog' ? sp.shopifyTitle : sp.productName || '';
          return fuzzyMatch(item.productName || '', spName);
        });

        if (match) {
          const newQty = Math.max(0, match.quantity - (item.quantity || 1));
          match.quantity = newQty;
          await match.save();

          const displayName = match.source === 'catalog' ? match.shopifyTitle : match.productName;
          const threshold = match.lowStockThreshold || 10;

          // Out of stock
          if (newQty === 0) {
            await Notification.create({
              type: 'low_stock',
              title: 'Product Out of Stock',
              message: `"${displayName}" by ${body.supplierName || 'Supplier'} is now out of stock.`,
              to: 'admin',
              link: '/admin/products',
            });
            await Notification.create({
              type: 'low_stock',
              title: 'Your Product is Out of Stock',
              message: `"${displayName}" is now out of stock. Please update your inventory.`,
              to: body.supplierId,
              link: '/supplier/products',
            });
          } else if (newQty > 0 && newQty <= threshold) {
            // Low stock warning
            await Notification.create({
              type: 'low_stock',
              title: 'Low Stock Warning',
              message: `"${displayName}" by ${body.supplierName || 'Supplier'} has only ${newQty} units left (threshold: ${threshold}).`,
              to: 'admin',
              link: '/admin/products',
            });
            await Notification.create({
              type: 'low_stock',
              title: 'Low Stock Warning',
              message: `"${displayName}" has only ${newQty} units left. Consider restocking.`,
              to: body.supplierId,
              link: '/supplier/products',
            });
          }
        }
      }
    } catch (stockErr: any) {
      console.error('Stock reduction error (non-blocking):', stockErr.message);
    }

    // Email supplier about the new order
    try {
      const supplier = await Supplier.findById(body.supplierId);
      if (supplier?.email) {
        sendOrderAssignedEmail(
          supplier.email,
          body.supplierName || supplier.name,
          body.items.length,
          body.shopifyOrderRef || '',
          body.items
        ).catch(() => {});
      }
    } catch {}

    // Invalidate orders cache
    await invalidateCachePattern('supplier-orders:*');

    return NextResponse.json({ success: true, order }, { status: 201 });
  } catch (error: any) {
    console.error('SupplierOrders POST Error:', error.message);
    return NextResponse.json({ error: 'Failed to assign order' }, { status: 500 });
  }
}

// PUT — update order status
export async function PUT(req: Request) {
  try {
    await dbConnect();
    const body = await req.json();
    const { orderId, action } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    }

    const order = await SupplierOrder.findById(orderId);
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const changedBy = body.changedBy || 'System';

    if (action === 'accept') {
      order.status = 'accepted';
      order.supplierReply = {
        totalAmount: body.totalAmount || 0,
        note: body.note || '',
      };
      order.respondedAt = new Date();
      pushTimeline(order, 'accepted', changedBy, `Quoted ₹${body.totalAmount}${body.note ? ' — ' + body.note : ''}`);
      await order.save();

      // Build items summary for notification
      const itemsSummary = (order.items || []).map((i: any) => `${i.productName} ×${i.quantity}`).join(', ');

      await Notification.create({
        type: 'order_response',
        title: 'Supplier Accepted Order',
        message: `${order.supplierName || 'Supplier'} accepted order${order.shopifyOrderRef ? ' (' + order.shopifyOrderRef + ')' : ''} and quoted ₹${body.totalAmount}. Items: ${itemsSummary}${body.note ? '. Note: ' + body.note : ''}`,
        from: order.supplierId,
        fromName: order.supplierName,
        to: 'admin',
        link: '/admin/order-acceptance',
        data: { orderId: order._id, totalAmount: body.totalAmount, note: body.note },
      });

      // Email admin with full details
      const acceptItemsHtml = (order.items || []).map((i: any) =>
        `<tr><td style="padding:4px 8px;font-size:13px;color:#374151;border-bottom:1px solid #f3f4f6;">${i.productName}</td><td style="padding:4px 8px;font-size:13px;color:#1f2937;text-align:right;border-bottom:1px solid #f3f4f6;">×${i.quantity}</td></tr>`
      ).join('');
      sendOrderStatusEmail(
        order.supplierName || 'Supplier',
        order.shopifyOrderRef || '',
        'Accepted',
        `Quoted ₹${body.totalAmount}${body.note ? '\nNote: ' + body.note : ''}\n\nItems:\n${(order.items || []).map((i: any) => `• ${i.productName} ×${i.quantity}`).join('\n')}`
      ).catch(() => {});

    } else if (action === 'reject') {
      order.status = 'rejected';
      order.rejectReason = body.reason || '';
      order.respondedAt = new Date();
      pushTimeline(order, 'rejected', changedBy, body.reason || '');
      await order.save();

      const reasonText = body.reason ? ` Reason: "${body.reason}"` : '';
      const itemsSummary = (order.items || []).map((i: any) => `${i.productName} ×${i.quantity}`).join(', ');

      await Notification.create({
        type: 'order_response',
        title: 'Supplier Rejected Order',
        message: `${order.supplierName || 'Supplier'} rejected the assigned order${order.shopifyOrderRef ? ' (' + order.shopifyOrderRef + ')' : ''}.${reasonText} Items: ${itemsSummary}`,
        from: order.supplierId,
        fromName: order.supplierName,
        to: 'admin',
        link: '/admin/order-acceptance',
        data: { orderId: order._id, reason: body.reason },
      });

      // Email admin with rejection reason
      sendOrderStatusEmail(
        order.supplierName || 'Supplier',
        order.shopifyOrderRef || '',
        'Rejected',
        `${body.reason || 'No reason provided'}\n\nItems:\n${(order.items || []).map((i: any) => `• ${i.productName} ×${i.quantity}`).join('\n')}`
      ).catch(() => {});

    } else if (action === 'cancel') {
      const prevStatus = order.status;
      order.status = 'cancelled';
      order.cancelledAt = new Date();
      order.cancelReason = body.reason || '';
      pushTimeline(order, 'cancelled', changedBy, body.reason || 'Order cancelled');
      await order.save();

      // Restore product quantities
      try {
        const supplierProducts = await SupplierProduct.find({
          supplierId: order.supplierId,
          status: 'approved',
        });

        for (const item of order.items || []) {
          const match = supplierProducts.find((sp: any) => {
            const spName = sp.source === 'catalog' ? sp.shopifyTitle : sp.productName || '';
            return fuzzyMatch(item.productName || '', spName);
          });
          if (match) {
            match.quantity += item.quantity || 0;
            await match.save();
          }
        }
      } catch (e: any) {
        console.error('Stock restore error:', e.message);
      }

      // Notify both sides
      await Notification.create({
        type: 'order_cancelled',
        title: 'Order Cancelled',
        message: `Order has been cancelled. ${body.reason ? 'Reason: ' + body.reason : ''}`,
        to: order.supplierId.toString(),
        link: '/supplier/orders',
      });
      await Notification.create({
        type: 'order_cancelled',
        title: 'Order Cancelled',
        message: `Order for ${order.supplierName || 'Supplier'} was cancelled. ${body.reason || ''}`,
        to: 'admin',
        link: '/admin/order-history',
      });

      // Email both sides
      sendOrderStatusEmail(
        order.supplierName || 'Supplier',
        order.shopifyOrderRef || '',
        'Cancelled',
        body.reason || ''
      ).catch(() => {});
      try {
        const supplier = await Supplier.findById(order.supplierId);
        if (supplier?.email) {
          sendSupplierNotificationEmail(
            supplier.email,
            `Order Cancelled${order.shopifyOrderRef ? ': ' + order.shopifyOrderRef : ''}`,
            `<p>Your order has been cancelled.${body.reason ? ' Reason: ' + body.reason : ''}</p>`,
            '/supplier/orders',
            'View Orders'
          ).catch(() => {});
        }
      } catch {}

    } else if (action === 'delivery_boy_coming') {
      order.status = 'delivery_boy_coming';
      order.deliveryUpdatedAt = new Date();
      if (body.deliveryBoyName) order.deliveryBoyName = body.deliveryBoyName;
      if (body.deliveryBoyPhone) order.deliveryBoyPhone = body.deliveryBoyPhone;
      pushTimeline(order, 'delivery_boy_coming', changedBy,
        body.deliveryBoyName ? `Delivery Boy: ${body.deliveryBoyName} (${body.deliveryBoyPhone || 'N/A'})` : '');
      await order.save();

      // Notify Supplier
      await Notification.create({
        type: 'order_assigned',
        title: 'Delivery Boy is Coming',
        message: `Admin assigned delivery boy${body.deliveryBoyName ? ' ' + body.deliveryBoyName : ''} for order ${order.shopifyOrderRef || ''}.`,
        to: order.supplierId.toString(),
        link: '/supplier/dispatch',
      });

      // Email supplier
      try {
        const supplier = await Supplier.findById(order.supplierId);
        if (supplier?.email) {
          sendSupplierNotificationEmail(
            supplier.email,
            `Delivery Boy Assigned for Order ${order.shopifyOrderRef || ''}`,
            `<p>Admin has assigned a delivery boy for your order.</p>
             ${body.deliveryBoyName ? `<p><strong>Name:</strong> ${body.deliveryBoyName}<br><strong>Phone:</strong> ${body.deliveryBoyPhone || 'N/A'}</p>` : ''}
             <p>Please prepare the package and hand it over when they arrive.</p>`,
            '/supplier/dispatch',
            'View Dispatch Details'
          ).catch(() => {});
        }
      } catch {}

    } else if (action === 'given_to_delivery') {
      order.status = 'given_to_delivery';
      order.deliveryUpdatedAt = new Date();
      pushTimeline(order, 'given_to_delivery', changedBy, 'Supplier gave package to delivery boy');
      await order.save();

      await Notification.create({
        type: 'dispatch_action',
        title: 'Delivery Boy Assigned',
        message: `${order.supplierName || 'Supplier'} has handed over the order to the delivery boy.`,
        from: order.supplierId,
        fromName: order.supplierName,
        to: 'admin',
        link: '/admin/deliveries',
        data: { orderId: order._id },
      });

    } else if (action === 'in_transit') {
      order.status = 'in_transit';
      order.deliveryUpdatedAt = new Date();
      pushTimeline(order, 'in_transit', changedBy);
      await order.save();

      await Notification.create({
        type: 'dispatch_action',
        title: 'Delivery Boy In Transit',
        message: `Delivery is on the way for ${order.supplierName || 'Supplier'}'s order.`,
        from: order.supplierId,
        fromName: order.supplierName,
        to: 'admin',
        link: '/admin/deliveries',
        data: { orderId: order._id },
      });

    } else if (action === 'delivered') {
      order.status = 'delivered';
      order.deliveredAt = new Date();
      pushTimeline(order, 'delivered', changedBy);
      await order.save();

      await Notification.create({
        type: 'dispatch_action',
        title: 'Order Marked as Delivered',
        message: `Admin has confirmed your order as delivered.`,
        to: order.supplierId.toString(),
        link: '/supplier/dispatch',
        data: { orderId: order._id },
      });

      // Email supplier about delivery
      try {
        const supplier = await Supplier.findById(order.supplierId);
        if (supplier?.email) {
          sendSupplierNotificationEmail(
            supplier.email,
            `Order Delivered${order.shopifyOrderRef ? ': ' + order.shopifyOrderRef : ''}`,
            `<p>Your order has been marked as <strong>delivered</strong> by admin.</p>`,
            '/supplier/dispatch',
            'View Dispatch'
          ).catch(() => {});
        }
      } catch {}

    } else if (action === 'complete') {
      order.status = 'completed';
      pushTimeline(order, 'completed', changedBy);
      await order.save();

    } else if (action === 'mark_paid') {
      order.paymentStatus = 'paid';
      order.paidAt = new Date();
      order.paidAmount = body.paidAmount || order.supplierReply?.totalAmount || 0;
      if (body.paymentRefType) order.paymentRefType = body.paymentRefType;
      if (body.paymentRefNumber) order.paymentRefNumber = body.paymentRefNumber;
      const refLabel = body.paymentRefType === 'utr' ? 'UTR' : 'Txn ID';
      const refNote = body.paymentRefNumber ? ` | ${refLabel}: ${body.paymentRefNumber}` : '';
      pushTimeline(order, 'paid', 'Admin', `Paid ₹${order.paidAmount}${refNote}`);
      await order.save();

      await Notification.create({
        type: 'payment_update',
        title: 'Payment Received',
        message: `Your payment of ₹${order.paidAmount} has been marked as paid.${refNote}`,
        to: order.supplierId.toString(),
        link: '/supplier/payouts',
      });

      // Email supplier about payment
      try {
        const supplier = await Supplier.findById(order.supplierId);
        if (supplier?.email) {
          sendSupplierNotificationEmail(
            supplier.email,
            `Payment Received: ₹${order.paidAmount}`,
            `<p>Your payment of <strong>₹${order.paidAmount}</strong> has been marked as paid by admin.</p>${refNote ? `<p><strong>${refLabel}:</strong> ${body.paymentRefNumber}</p>` : ''}`,
            '/supplier/payouts',
            'View Payouts'
          ).catch(() => {});
        }
      } catch {}

    } else if (action === 'request_gst_invoice') {
      pushTimeline(order, order.status, changedBy, 'GST invoice requested by supplier');
      await order.save();
      // Use native MongoDB driver to bypass Mongoose schema cache
      await SupplierOrder.collection.updateOne(
        { _id: order._id },
        { $set: { gstInvoiceRequested: true, gstInvoiceRequestedAt: new Date() } }
      );

      // Notify admin
      await Notification.create({
        type: 'order_response',
        title: 'GST Invoice Requested',
        message: `${order.supplierName || 'Supplier'} requested a GST invoice for order ${order.shopifyOrderRef || order._id}.`,
        to: 'admin',
        link: '/admin/gst-requests',
      });

      // Email admin
      try {
        sendOrderStatusEmail(
          order.supplierName || 'Supplier',
          order.shopifyOrderRef || order._id.toString(),
          'GST Invoice Requested',
          `Supplier has requested a GST invoice for this order.`
        ).catch(() => {});
      } catch {}

    } else if (action === 'mark_gst_sent') {
      await SupplierOrder.collection.updateOne(
        { _id: order._id },
        { $set: { gstInvoiceSent: true, gstInvoiceSentAt: new Date() } }
      );
      pushTimeline(order, order.status, changedBy, 'GST invoice sent to supplier email');
      await order.save();
    }

    // Invalidate orders cache
    await invalidateCachePattern('supplier-orders:*');

    return NextResponse.json({ success: true, order });
  } catch (error: any) {
    console.error('SupplierOrders PUT Error:', error.message);
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }
}
