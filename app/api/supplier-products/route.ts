import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import SupplierProduct from '@/models/SupplierProduct';
import Supplier from '@/models/Supplier';
import Notification from '@/models/Notification';
import { getUserFromRequest } from '@/lib/auth';
import { getShopifyClient } from '@/lib/shopifyClient';
import { sendProductUpdateEmail, sendProductSubmissionEmail, sendProductDecisionEmail } from '@/lib/email';

// GET — fetch supplier product requests
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

    const products = await SupplierProduct.find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    return NextResponse.json({ products });
  } catch (error: any) {
    console.error('SupplierProducts GET Error:', error.message);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

// POST — supplier adds a product (from catalog or direct)
export async function POST(req: Request) {
  try {
    await dbConnect();
    const body = await req.json();
    const source = body.source || 'catalog';

    const productData: any = {
      supplierId: body.supplierId,
      supplierName: body.supplierName || '',
      source,
      quantity: body.quantity,
      sellingPrice: body.sellingPrice,
      mrp: body.mrp || undefined,
      status: 'pending',
      variants: body.variants || [],
    };

    if (source === 'catalog') {
      productData.shopifyProductId = body.shopifyProductId;
      productData.shopifyTitle = body.shopifyTitle;
      productData.shopifyImage = body.shopifyImage || '';
    } else {
      productData.productName = body.productName;
      productData.productDescription = body.productDescription || '';
      productData.productImages = body.productImages || [];
      productData.productCategory = body.productCategory || '';
      productData.productUnit = body.productUnit || 'pcs';
    }

    const product = await SupplierProduct.create(productData);

    const displayName = source === 'catalog' ? body.shopifyTitle : body.productName;

    // Notify admin
    await Notification.create({
      type: 'product_request',
      title: source === 'catalog' ? 'Catalog Product Submission' : 'New Product Addition Request',
      message: `${body.supplierName || 'Supplier'} wants to ${source === 'catalog' ? 'sell' : 'add'} "${displayName}" — Qty: ${body.quantity}, Price: ₹${body.sellingPrice}`,
      from: body.supplierId,
      fromName: body.supplierName,
      to: 'admin',
      link: '/admin/submissions',
      data: {
        productId: product._id,
        source,
        shopifyProductId: body.shopifyProductId,
        displayName,
        quantity: body.quantity,
        sellingPrice: body.sellingPrice,
      },
    });

    // Email admin about new submission
    sendProductSubmissionEmail(
      body.supplierName || 'Supplier',
      displayName || 'Unknown Product',
      body.quantity,
      body.sellingPrice,
      source,
      body.variants?.length || 0
    ).catch(() => {});

    return NextResponse.json({ success: true, product }, { status: 201 });
  } catch (error: any) {
    console.error('SupplierProducts POST Error:', error.message);
    return NextResponse.json({ error: 'Failed to add product' }, { status: 500 });
  }
}

// PUT — admin approves/rejects.
//   catalog source → just approve (product already exists in Shopify)
//   direct source → approve & push to Shopify as draft
export async function PUT(req: Request) {
  try {
    await dbConnect();
    const user = getUserFromRequest(req);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized — admin only' }, { status: 401 });
    }

    const body = await req.json();
    const { productId, action } = body;

    if (!productId) {
      return NextResponse.json({ error: 'productId is required' }, { status: 400 });
    }

    const product = await SupplierProduct.findById(productId);
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    if (action === 'approve') {
      const isCatalog = product.source === 'catalog';

      if (isCatalog) {
        // Product already exists in Shopify — just mark approved
        product.status = 'approved';
        await product.save();

        await Notification.create({
          type: 'product_request',
          title: 'Product Approved',
          message: `Your product "${product.shopifyTitle}" has been approved by admin.`,
          to: product.supplierId.toString(),
          link: '/supplier/products',
        });

        // Email supplier about approval
        try {
          const supplier = await Supplier.findById(product.supplierId);
          if (supplier?.email) {
            sendProductDecisionEmail(supplier.email, supplier.name, product.shopifyTitle, 'approved', false).catch(() => {});
          }
        } catch {} 

        return NextResponse.json({ success: true, product });
      } else {
        // Direct product — push to Shopify as draft
        const shopify = getShopifyClient();
        const shopifyProduct = {
          title: product.productName || body.title || '',
          body_html: product.productDescription || body.description || '',
          vendor: product.supplierName || '',
          product_type: product.productCategory || body.product_type || '',
          status: 'draft',
          variants: [{
            price: String(product.sellingPrice),
            inventory_management: 'shopify',
            inventory_quantity: product.quantity,
            sku: body.sku || '',
          }],
        };

        // Images are intentionally omitted to prevent Shopify "Image URL is invalid" errors for local paths.
        const res = await shopify.post('/products.json', { product: shopifyProduct });

        product.status = 'approved';
        await product.save();

        await Notification.create({
          type: 'product_request',
          title: 'Product Approved & Added to Shopify',
          message: `Your product "${product.productName}" has been approved and added to Shopify as draft.`,
          to: product.supplierId.toString(),
          link: '/supplier/products',
          data: { shopifyNewId: res.data.product?.id },
        });

        // Email supplier about approval + Shopify add
        try {
          const supplier = await Supplier.findById(product.supplierId);
          if (supplier?.email) {
            sendProductDecisionEmail(supplier.email, supplier.name, product.productName, 'approved', true).catch(() => {});
          }
        } catch {} 

        return NextResponse.json({ success: true, product, shopifyProduct: res.data.product });
      }
    } else if (action === 'reject') {
      product.status = 'rejected';
      await product.save();

      const displayName = product.source === 'catalog' ? product.shopifyTitle : product.productName;
      await Notification.create({
        type: 'product_request',
        title: 'Product Rejected',
        message: `Your product "${displayName}" was rejected by admin.`,
        to: product.supplierId.toString(),
        link: '/supplier/products',
      });

      // Email supplier about rejection
      try {
        const supplier = await Supplier.findById(product.supplierId);
        if (supplier?.email) {
          sendProductDecisionEmail(supplier.email, supplier.name, displayName, 'rejected').catch(() => {});
        }
      } catch {} 

      return NextResponse.json({ success: true, product });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('SupplierProducts PUT Error:', error.response?.data || error.message);
    return NextResponse.json({ error: 'Failed to process' }, { status: 500 });
  }
}

// PATCH — supplier updates quantity/price/availability on their products
export async function PATCH(req: Request) {
  try {
    await dbConnect();
    const user = getUserFromRequest(req);
    if (!user || user.role !== 'supplier') {
      return NextResponse.json({ error: 'Unauthorized — supplier only' }, { status: 401 });
    }

    const body = await req.json();
    const { productId, quantity, sellingPrice, mrp, variants, availability, stockAdjustment } = body;

    if (!productId) {
      return NextResponse.json({ error: 'productId is required' }, { status: 400 });
    }

    const product = await SupplierProduct.findById(productId);
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Fetch latest supplier name (in case it was updated by admin)
    const supplier = await Supplier.findById(product.supplierId).select('name businessName');
    const supplierName = supplier?.name || product.supplierName || 'Supplier';
    // Update cached name on the product if it changed
    if (supplier?.name && supplier.name !== product.supplierName) {
      product.supplierName = supplier.name;
    }

    const displayName = product.source === 'catalog' ? product.shopifyTitle : product.productName;

    // --- Availability toggle ---
    if (availability !== undefined && ['available', 'unavailable', 'out_of_stock'].includes(availability)) {
      if (availability !== product.availability) {
        const prevAvailability = product.availability || 'available';
        product.availability = availability;
        await product.save();

        const changesList = [{ field: 'Availability', from: prevAvailability.replace(/_/g, ' '), to: availability.replace(/_/g, ' ') }];
        await Notification.create({
          type: 'product_update',
          title: 'Product Availability Changed',
          message: `${supplierName} changed "${displayName}" availability to ${availability.replace(/_/g, ' ').toUpperCase()}.`,
          from: product.supplierId,
          fromName: supplierName,
          to: 'admin',
          link: '/admin/product-updates',
          data: { productId: product._id, supplierId: product.supplierId, changes: changesList },
        });

        sendProductUpdateEmail(
          displayName || 'Unknown Product',
          supplierName,
          changesList.map(c => `<strong>${c.field}:</strong> ${c.from} → ${c.to}`).join('<br>')
        ).catch(() => {});

        return NextResponse.json({ success: true, product });
      }
      return NextResponse.json({ success: true, product, message: 'No change' });
    }

    // --- Stock adjustment with reason logging ---
    if (stockAdjustment) {
      const { newQuantity, reason, note } = stockAdjustment;
      if (newQuantity === undefined || newQuantity < 0) {
        return NextResponse.json({ error: 'Valid newQuantity is required' }, { status: 400 });
      }
      if (!reason) {
        return NextResponse.json({ error: 'Reason is required for stock adjustment' }, { status: 400 });
      }

      const previousQty = product.quantity;
      product.quantity = newQuantity;

      // Auto-toggle availability based on stock
      if (newQuantity === 0) {
        product.availability = 'out_of_stock';
      } else if (product.availability === 'out_of_stock' && newQuantity > 0) {
        product.availability = 'available';
      }

      // Push to adjustment log
      if (!product.stockAdjustmentLog) product.stockAdjustmentLog = [];
      product.stockAdjustmentLog.push({
        reason,
        note: note || '',
        previousQty,
        newQty: newQuantity,
        adjustedBy: user.id,
        timestamp: new Date(),
      });

      await product.save();

      // Low stock / out of stock notifications
      const threshold = product.lowStockThreshold || 10;
      const stockChangesList = [{ field: 'Stock', from: String(previousQty), to: String(newQuantity) }];
      if (reason) stockChangesList.push({ field: 'Reason', from: '', to: reason.replace(/_/g, ' ') });
      if (note) stockChangesList.push({ field: 'Note', from: '', to: note });

      if (newQuantity === 0) {
        await Notification.create({
          type: 'low_stock',
          title: 'Product Out of Stock',
          message: `"${displayName}" by ${supplierName} is now out of stock. Adjusted from ${previousQty} → 0. Reason: ${reason}`,
          to: 'admin',
          link: '/admin/product-updates',
          data: { productId: product._id, supplierId: product.supplierId, changes: stockChangesList },
        });
      } else if (newQuantity > 0 && newQuantity <= threshold) {
        await Notification.create({
          type: 'low_stock',
          title: 'Low Stock Warning',
          message: `"${displayName}" by ${supplierName} has ${newQuantity} units left (threshold: ${threshold}). Adjusted from ${previousQty}. Reason: ${reason}`,
          to: 'admin',
          link: '/admin/product-updates',
          data: { productId: product._id, supplierId: product.supplierId, changes: stockChangesList },
        });
      }

      await Notification.create({
        type: 'product_update',
        title: 'Stock Adjusted',
        message: `${supplierName} adjusted stock for "${displayName}": ${previousQty} → ${newQuantity}. Reason: ${reason}${note ? ' — ' + note : ''}`,
        from: product.supplierId,
        fromName: supplierName,
        to: 'admin',
        link: '/admin/product-updates',
        data: { productId: product._id, supplierId: product.supplierId, changes: stockChangesList },
      });

      sendProductUpdateEmail(
        displayName || 'Unknown Product',
        supplierName,
        stockChangesList.filter(c => c.from).map(c => `<strong>${c.field}:</strong> ${c.from} → ${c.to}`).join('<br>')
        + (reason ? `<br><strong>Reason:</strong> ${reason.replace(/_/g, ' ')}` : '')
        + (note ? `<br><strong>Note:</strong> ${note}` : '')
      ).catch(() => {});

      return NextResponse.json({ success: true, product });
    }

    // --- Legacy: quantity/price/variants update ---
    const changes: string[] = [];
    const structuredChanges: { field: string; from: string; to: string }[] = [];

    if (quantity !== undefined && quantity !== product.quantity) {
      const previousQty = product.quantity;
      changes.push(`Overall Quantity: ${product.quantity} → ${quantity}`);
      structuredChanges.push({ field: 'Quantity', from: String(product.quantity), to: String(quantity) });
      product.quantity = quantity;

      // Auto-toggle availability
      if (quantity === 0) {
        product.availability = 'out_of_stock';
      } else if (product.availability === 'out_of_stock' && quantity > 0) {
        product.availability = 'available';
      }

      // Log the adjustment
      if (!product.stockAdjustmentLog) product.stockAdjustmentLog = [];
      product.stockAdjustmentLog.push({
        reason: 'correction',
        note: 'Updated via product edit',
        previousQty,
        newQty: quantity,
        adjustedBy: user.id,
        timestamp: new Date(),
      });
    }
    if (sellingPrice !== undefined && sellingPrice !== product.sellingPrice) {
      changes.push(`Selling Price: ₹${product.sellingPrice} → ₹${sellingPrice}`);
      structuredChanges.push({ field: 'Selling Price', from: `₹${product.sellingPrice}`, to: `₹${sellingPrice}` });
      product.sellingPrice = sellingPrice;
    }
    if (mrp !== undefined) {
      if (mrp !== product.mrp) {
        changes.push(`MRP: ₹${product.mrp || 'N/A'} → ₹${mrp}`);
        structuredChanges.push({ field: 'MRP', from: `₹${product.mrp || 'N/A'}`, to: `₹${mrp}` });
        product.mrp = mrp;
      }
    }

    let variantsHtml = '';
    let variantsText = '';
    if (variants && Array.isArray(variants)) {
      const oldVariants = product.variants || [];
      const oldVariantsStr = JSON.stringify(oldVariants);
      const newVariantsStr = JSON.stringify(variants);
      if (oldVariantsStr !== newVariantsStr) {
        changes.push(`Variants updated (${variants.length} variant${variants.length === 1 ? '' : 's'})`);

        // Build per-variant change details
        variants.forEach((nv: any) => {
          const ov = oldVariants.find((o: any) => (o.variantId && o.variantId === nv.variantId) || o.title === nv.title);
          const label = nv.title || 'Default';
          if (!ov) {
            structuredChanges.push({ field: `Variant "${label}" (New)`, from: '', to: `₹${nv.sellingPrice} x ${nv.quantity}${nv.mrp ? ` (MRP: ₹${nv.mrp})` : ''}` });
          } else {
            if (ov.sellingPrice !== nv.sellingPrice) structuredChanges.push({ field: `Variant "${label}" Price`, from: `₹${ov.sellingPrice}`, to: `₹${nv.sellingPrice}` });
            if (ov.quantity !== nv.quantity) structuredChanges.push({ field: `Variant "${label}" Qty`, from: String(ov.quantity), to: String(nv.quantity) });
            if ((ov.mrp || 0) !== (nv.mrp || 0)) structuredChanges.push({ field: `Variant "${label}" MRP`, from: ov.mrp ? `₹${ov.mrp}` : 'N/A', to: nv.mrp ? `₹${nv.mrp}` : 'N/A' });
          }
        });

        product.variants = variants;
      }

      variantsHtml = `<br><br><strong>Current Variants:</strong><br><table style="width:100%;border-collapse:collapse;margin-top:10px;">
        <tr style="background:#f9fafb;text-align:left;">
          <th style="padding:8px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#6b7280;">Variant</th>
          <th style="padding:8px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#6b7280;text-align:right;">MRP</th>
          <th style="padding:8px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#6b7280;text-align:right;">Price</th>
          <th style="padding:8px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#6b7280;text-align:right;">Qty</th>
        </tr>
        ${variants.map(v => `
          <tr>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;font-size:13px;">${v.title || 'Default'} ${v.color ? `(${v.color})` : ''}</td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:right;">${v.mrp ? `₹${v.mrp}` : '—'}</td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:right;">₹${v.sellingPrice}</td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:right;">${v.quantity}</td>
          </tr>
        `).join('')}
      </table>`;

      variantsText = ` | Variants updated: ${variants.map(v => `${v.title || 'Default'} (₹${v.sellingPrice} x ${v.quantity})`).join(', ')}`;
    }

    if (changes.length === 0) {
      return NextResponse.json({ success: true, product, message: 'No changes' });
    }

    await product.save();

    // Notify admin
    await Notification.create({
      type: 'product_update',
      title: 'Product Updated',
      message: `${supplierName} updated "${displayName}": ${changes.join(', ')}${variantsText}`,
      from: product.supplierId,
      fromName: supplierName,
      to: 'admin',
      link: '/admin/product-updates',
      data: { productId: product._id, supplierId: product.supplierId, changes: structuredChanges },
    });

    // Send email to admin
    const emailChangesHtml = structuredChanges.map(c =>
      c.from ? `<strong>${c.field}:</strong> ${c.from} → ${c.to}` : `<strong>${c.field}:</strong> ${c.to}`
    ).join('<br>');
    sendProductUpdateEmail(
      displayName || 'Unknown Product',
      supplierName,
      `${emailChangesHtml}${variantsHtml}`
    ).catch(() => {});

    return NextResponse.json({ success: true, product });
  } catch (error: any) {
    console.error('SupplierProducts PATCH Error:', error.message);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}


