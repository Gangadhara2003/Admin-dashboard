import { NextResponse } from 'next/server';
import { getShopifyClient } from '@/lib/shopifyClient';
import { invalidateCachePattern, invalidateCache, CACHE_KEYS } from '@/lib/redis';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const shopify = getShopifyClient();
    const response = await shopify.get(`/orders/${id}.json`);
    const order = response.data.order;

    // Enrich line items with product images
    if (order.line_items?.length > 0) {
      const productIds = [...new Set(order.line_items.map((item: any) => item.product_id).filter(Boolean))];
      if (productIds.length > 0) {
        try {
          const productsRes = await shopify.get(`/products.json?ids=${productIds.join(',')}`);
          const productMap: Record<number, any> = {};
          productsRes.data.products.forEach((p: any) => { productMap[p.id] = p; });
          order.line_items.forEach((item: any) => {
            if (item.product_id && productMap[item.product_id]) {
              const product = productMap[item.product_id];
              item.image = product.image || (product.images?.[0] || null);
            }
          });
        } catch (e) { /* non-fatal */ }
      }
    }

    return NextResponse.json({ order });
  } catch (error: any) {
    console.error('Shopify Order Detail Error:', error.response?.data || error.message);
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }
}

/** POST — Cancel or Refund an order */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const shopify = getShopifyClient();
    const body = await req.json();
    const { action } = body;

    if (action === 'cancel') {
      const response = await shopify.post(`/orders/${id}/cancel.json`, {
        reason: body.reason || 'other',
        email: body.notify !== false,
      });
      await invalidateCachePattern('shopify:orders:*');
      await invalidateCache(CACHE_KEYS.SHOPIFY_ANALYTICS);
      return NextResponse.json({ success: true, order: response.data.order });
    }

    if (action === 'refund') {
      // Calculate refund
      const calcRes = await shopify.post(`/orders/${id}/refunds/calculate.json`, {
        refund: { shipping: { full_refund: true } },
      });
      const calculatedRefund = calcRes.data.refund;

      const refundRes = await shopify.post(`/orders/${id}/refunds.json`, {
        refund: {
          shipping: calculatedRefund.shipping,
          refund_line_items: calculatedRefund.refund_line_items,
          note: body.note || 'Refund processed via admin dashboard',
          notify: body.notify !== false,
        },
      });
      await invalidateCachePattern('shopify:orders:*');
      await invalidateCache(CACHE_KEYS.SHOPIFY_ANALYTICS);
      return NextResponse.json({ success: true, refund: refundRes.data.refund });
    }

    if (action === 'fulfill') {
      // Get fulfillment orders
      const foRes = await shopify.get(`/orders/${id}/fulfillment_orders.json`);
      const fulfillmentOrders = foRes.data.fulfillment_orders || [];
      const openFO = fulfillmentOrders.find((fo: any) => fo.status === 'open');
      if (!openFO) {
        return NextResponse.json({ error: 'No open fulfillment order found' }, { status: 400 });
      }

      const fulfillRes = await shopify.post('/fulfillments.json', {
        fulfillment: {
          line_items_by_fulfillment_order: [{
            fulfillment_order_id: openFO.id,
          }],
          tracking_info: body.tracking ? {
            number: body.tracking.number,
            company: body.tracking.company || '',
            url: body.tracking.url || '',
          } : undefined,
          notify_customer: body.notify !== false,
        },
      });
      await invalidateCachePattern('shopify:orders:*');
      await invalidateCache(CACHE_KEYS.SHOPIFY_ANALYTICS);
      return NextResponse.json({ success: true, fulfillment: fulfillRes.data.fulfillment });
    }

    return NextResponse.json({ error: 'Invalid action. Use: cancel, refund, fulfill' }, { status: 400 });
  } catch (error: any) {
    console.error('Shopify Order Action Error:', error.response?.data || error.message);
    return NextResponse.json({ error: error.response?.data?.errors || 'Action failed' }, { status: 500 });
  }
}
