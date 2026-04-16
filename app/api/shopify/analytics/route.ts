import { NextResponse } from 'next/server';
import { getShopifyClient } from '@/lib/shopifyClient';
import { getCache, setCache, CACHE_KEYS } from '@/lib/redis';

export async function GET() {
  try {
    // Check Redis cache first
    const cached = await getCache(CACHE_KEYS.SHOPIFY_ANALYTICS);
    if (cached) {
      return NextResponse.json(cached);
    }

    const shopify = getShopifyClient();

    // Fetch recent orders to compute analytics
    const [ordersRes, productsRes, customersRes] = await Promise.all([
      shopify.get('/orders.json?status=any&limit=250'),
      shopify.get('/products/count.json'),
      shopify.get('/customers/count.json'),
    ]);

    const orders = ordersRes.data.orders || [];
    const productCount = productsRes.data.count || 0;
    const customerCount = customersRes.data.count || 0;

    // Today's date for filtering
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(today.getDate() - 7);

    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    // Compute KPIs
    const todaysOrders = orders.filter((o: any) => new Date(o.created_at) >= today);
    const thisWeekOrders = orders.filter((o: any) => new Date(o.created_at) >= thisWeekStart);
    const thisMonthOrders = orders.filter((o: any) => new Date(o.created_at) >= thisMonthStart);

    const totalRevenue = orders.reduce((sum: number, o: any) => sum + parseFloat(o.total_price || 0), 0);
    const todaysRevenue = todaysOrders.reduce((sum: number, o: any) => sum + parseFloat(o.total_price || 0), 0);
    const weeklyRevenue = thisWeekOrders.reduce((sum: number, o: any) => sum + parseFloat(o.total_price || 0), 0);
    const monthlyRevenue = thisMonthOrders.reduce((sum: number, o: any) => sum + parseFloat(o.total_price || 0), 0);

    // Order status breakdown
    const pendingOrders = orders.filter((o: any) => o.fulfillment_status === null && o.financial_status === 'paid').length;
    const fulfilledOrders = orders.filter((o: any) => o.fulfillment_status === 'fulfilled').length;
    const cancelledOrders = orders.filter((o: any) => o.cancelled_at !== null).length;
    const refundedOrders = orders.filter((o: any) => o.financial_status === 'refunded').length;

    // Payment method breakdown
    const codOrders = orders.filter((o: any) => o.gateway === 'cash_on_delivery' || o.tags?.includes('COD')).length;
    const paidOrders = orders.filter((o: any) => o.financial_status === 'paid').length;

    // Top products (from line items)
    const productSales: Record<string, { title: string; qty: number; revenue: number }> = {};
    orders.forEach((o: any) => {
      o.line_items?.forEach((item: any) => {
        const key = item.product_id || item.title;
        if (!productSales[key]) productSales[key] = { title: item.title, qty: 0, revenue: 0 };
        productSales[key].qty += item.quantity;
        productSales[key].revenue += parseFloat(item.price) * item.quantity;
      });
    });
    const topProducts = Object.values(productSales).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

    // Daily revenue for chart (last 7 days)
    const dailyRevenue: { date: string; revenue: number; orders: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date(today);
      day.setDate(today.getDate() - i);
      const dayStr = day.toISOString().split('T')[0];
      const dayOrders = orders.filter((o: any) => o.created_at?.startsWith(dayStr));
      dailyRevenue.push({
        date: dayStr,
        revenue: dayOrders.reduce((s: number, o: any) => s + parseFloat(o.total_price || 0), 0),
        orders: dayOrders.length,
      });
    }

    const responseData = {
      kpis: {
        totalOrders: orders.length,
        todaysOrders: todaysOrders.length,
        pendingOrders,
        fulfilledOrders,
        cancelledOrders,
        refundedOrders,
        codOrders,
        paidOrders,
        totalRevenue,
        todaysRevenue,
        weeklyRevenue,
        monthlyRevenue,
        productCount,
        customerCount,
      },
      topProducts,
      dailyRevenue,
    };

    // Cache for 1 hour
    await setCache(CACHE_KEYS.SHOPIFY_ANALYTICS, responseData);

    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error('Shopify Analytics Error:', error.response?.data || error.message);
    return NextResponse.json({ error: 'Failed to compute analytics' }, { status: 500 });
  }
}
