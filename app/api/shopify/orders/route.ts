import { NextResponse } from 'next/server';
import { getShopifyClient } from '@/lib/shopifyClient';
import { getCache, setCache, CACHE_KEYS } from '@/lib/redis';

export async function GET(req: Request) {
  try {
    const shopify = getShopifyClient();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'any';
    const limit = searchParams.get('limit') || '50';

    // Check Redis cache first
    const cacheKey = CACHE_KEYS.SHOPIFY_ORDERS(limit, status);
    const cached = await getCache(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    const response = await shopify.get(`/orders.json?status=${status}&limit=${limit}`);
    const orders = response.data.orders || [];

    const responseData = { orders, count: orders.length };

    // Cache for 1 hour
    await setCache(cacheKey, responseData);

    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error('Shopify Orders Error:', error.response?.data || error.message);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}
