import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import PriceRevision from '@/models/PriceRevision';
import SupplierProduct from '@/models/SupplierProduct';
import Notification from '@/models/Notification';
import { getUserFromRequest } from '@/lib/auth';

// GET — list price revision requests
export async function GET(req: Request) {
  try {
    await dbConnect();
    const user = getUserFromRequest(req);
    if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    let filter: any = {};

    if (user.role === 'supplier') {
      filter.supplierId = user.id;
    } else if (searchParams.get('supplierId')) {
      filter.supplierId = searchParams.get('supplierId');
    }
    if (searchParams.get('status')) {
      filter.status = searchParams.get('status');
    }

    const revisions = await PriceRevision.find(filter).sort({ createdAt: -1 }).limit(100).lean();
    return NextResponse.json({ revisions });
  } catch (error: any) {
    console.error('PriceRevision GET error:', error.message);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

// POST — supplier submits a price revision request
export async function POST(req: Request) {
  try {
    await dbConnect();
    const user = getUserFromRequest(req);
    if (!user?.id || user.role !== 'supplier') {
      return NextResponse.json({ error: 'Unauthorized — supplier only' }, { status: 401 });
    }

    const body = await req.json();
    const { productId, requestedPrice, reason } = body;

    if (!productId || !requestedPrice) {
      return NextResponse.json({ error: 'productId and requestedPrice are required' }, { status: 400 });
    }

    const product = await SupplierProduct.findById(productId);
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    // Check for pending request on same product
    const existing = await PriceRevision.findOne({
      productId,
      supplierId: user.id,
      status: 'pending',
    });
    if (existing) {
      return NextResponse.json({ error: 'There is already a pending price revision for this product.' }, { status: 409 });
    }

    const displayName = product.source === 'catalog' ? product.shopifyTitle : product.productName;

    const revision = await PriceRevision.create({
      supplierId: user.id,
      supplierName: product.supplierName || body.supplierName || 'Supplier',
      productId,
      productName: displayName || 'Unknown Product',
      currentPrice: product.sellingPrice,
      requestedPrice,
      reason: reason || '',
      status: 'pending',
      history: [{
        price: requestedPrice,
        changedAt: new Date(),
        changedBy: product.supplierName || 'Supplier',
        action: 'requested',
      }],
    });

    // Notify admin
    await Notification.create({
      type: 'price_update',
      title: 'Price Revision Request',
      message: `${product.supplierName || 'Supplier'} requested price change for "${displayName}": ₹${product.sellingPrice} → ₹${requestedPrice}. ${reason ? 'Reason: ' + reason : ''}`,
      from: user.id,
      fromName: product.supplierName,
      to: 'admin',
      link: '/admin/submissions',
      data: { revisionId: revision._id, productId },
    });

    return NextResponse.json({ success: true, revision }, { status: 201 });
  } catch (error: any) {
    console.error('PriceRevision POST error:', error.message);
    return NextResponse.json({ error: 'Failed to submit' }, { status: 500 });
  }
}

// PUT — admin approves/rejects a revision request
export async function PUT(req: Request) {
  try {
    await dbConnect();
    const user = getUserFromRequest(req);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized — admin only' }, { status: 401 });
    }

    const body = await req.json();
    const { revisionId, action, adminNote } = body;

    if (!revisionId || !action) {
      return NextResponse.json({ error: 'revisionId and action are required' }, { status: 400 });
    }

    const revision = await PriceRevision.findById(revisionId);
    if (!revision) return NextResponse.json({ error: 'Revision not found' }, { status: 404 });

    if (action === 'approve') {
      revision.status = 'approved';
      revision.reviewedAt = new Date();
      revision.reviewedBy = 'Admin';
      revision.adminNote = adminNote || '';
      revision.history.push({
        price: revision.requestedPrice,
        changedAt: new Date(),
        changedBy: 'Admin',
        action: 'approved',
      });
      await revision.save();

      // Update product price
      const product = await SupplierProduct.findById(revision.productId);
      if (product) {
        product.sellingPrice = revision.requestedPrice;
        await product.save();
      }

      // Notify supplier
      await Notification.create({
        type: 'price_update',
        title: 'Price Revision Approved',
        message: `Your price revision for "${revision.productName}" has been approved. New price: ₹${revision.requestedPrice}${adminNote ? '. Note: ' + adminNote : ''}`,
        to: revision.supplierId.toString(),
        link: '/supplier/price-revisions',
      });

      return NextResponse.json({ success: true, revision });

    } else if (action === 'reject') {
      revision.status = 'rejected';
      revision.reviewedAt = new Date();
      revision.reviewedBy = 'Admin';
      revision.adminNote = adminNote || '';
      revision.history.push({
        price: revision.requestedPrice,
        changedAt: new Date(),
        changedBy: 'Admin',
        action: 'rejected',
      });
      await revision.save();

      // Notify supplier
      await Notification.create({
        type: 'price_update',
        title: 'Price Revision Rejected',
        message: `Your price revision for "${revision.productName}" was rejected.${adminNote ? ' Reason: ' + adminNote : ''}`,
        to: revision.supplierId.toString(),
        link: '/supplier/price-revisions',
      });

      return NextResponse.json({ success: true, revision });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('PriceRevision PUT error:', error.message);
    return NextResponse.json({ error: 'Failed to process' }, { status: 500 });
  }
}
