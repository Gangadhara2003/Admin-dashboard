import { NextResponse } from 'next/server';
import { getShopifyClient } from '@/lib/shopifyClient';
import { getCache, setCache, CACHE_KEYS } from '@/lib/redis';

export async function GET(req: Request) {
  try {
    const shopify = getShopifyClient();
    const { searchParams } = new URL(req.url);
    const limit = searchParams.get('limit') || '50';

    // Check Redis cache first
    const cacheKey = CACHE_KEYS.SHOPIFY_CUSTOMERS(limit);
    const cached = await getCache(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    const response = await shopify.get(`/customers.json?limit=${limit}`);
    const customers = response.data.customers || [];

    const responseData = { customers, count: customers.length };

    // Cache for 1 hour
    await setCache(cacheKey, responseData);

    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error('Shopify Customers Error:', error.response?.data || error.message);
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
  }
}
