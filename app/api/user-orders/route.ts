import { NextResponse } from 'next/server';
import { getShopifyClient } from '@/lib/shopifyClient';
import { getUserFromRequest } from '@/lib/auth';

// GET — fetch Shopify orders by customer phone number
export async function GET(req: Request) {
  try {
    const user = getUserFromRequest(req);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const phone = searchParams.get('phone');

    if (!phone) {
      return NextResponse.json({ error: 'phone query param is required' }, { status: 400 });
    }

    const shopify = getShopifyClient();

    // Step 1: Search for customer by phone
    const customerRes = await shopify.get(`/customers/search.json?query=phone:${encodeURIComponent(phone)}&limit=5`);
    const customers = customerRes.data.customers || [];

    if (customers.length === 0) {
      return NextResponse.json({ orders: [], customer: null, message: 'No Shopify customer found with this phone' });
    }

    const customer = customers[0];

    // Step 2: Get orders for that customer
    const ordersRes = await shopify.get(`/orders.json?customer_id=${customer.id}&status=any&limit=50`);
    const orders = (ordersRes.data.orders || []).map((o: any) => ({
      id: o.id,
      name: o.name,                        // e.g. #1001
      total: o.total_price,
      subtotal: o.subtotal_price,
      currency: o.currency,
      status: o.financial_status,
      fulfillment: o.fulfillment_status || 'unfulfilled',
      items: (o.line_items || []).map((li: any) => ({
        title: li.title,
        quantity: li.quantity,
        price: li.price,
      })),
      itemCount: o.line_items?.length || 0,
      createdAt: o.created_at,
      shippingAddress: o.shipping_address ? {
        city: o.shipping_address.city,
        province: o.shipping_address.province,
        zip: o.shipping_address.zip,
        address1: o.shipping_address.address1,
      } : null,
    }));

    return NextResponse.json({
      customer: {
        id: customer.id,
        name: `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),
        email: customer.email,
        phone: customer.phone,
        ordersCount: customer.orders_count,
        totalSpent: customer.total_spent,
      },
      orders,
      totalOrders: orders.length,
    });
  } catch (error: any) {
    console.error('User Orders Error:', error.response?.data || error.message);
    return NextResponse.json({ error: 'Failed to fetch user orders' }, { status: 500 });
  }
}
