import axios, { AxiosInstance } from 'axios';

const SHOPIFY_SHOP_URL = process.env.SHOPIFY_SHOP_URL!;
const SHOPIFY_ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN!;
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2026-01';

let _client: AxiosInstance | null = null;

export function getShopifyClient(): AxiosInstance {
  if (_client) return _client;

  if (!SHOPIFY_SHOP_URL || !SHOPIFY_ADMIN_TOKEN) {
    throw new Error('Missing SHOPIFY_SHOP_URL or SHOPIFY_ADMIN_TOKEN in environment variables');
  }

  _client = axios.create({
    baseURL: `${SHOPIFY_SHOP_URL}/admin/api/${SHOPIFY_API_VERSION}`,
    headers: {
      'X-Shopify-Access-Token': SHOPIFY_ADMIN_TOKEN,
      'Content-Type': 'application/json',
    },
  });

  return _client;
}

/** Extract numeric ID from Shopify GID string */
export function parseGid(gid: string | null): number | null {
  if (!gid) return null;
  return Number(gid.split('/').pop()) || null;
}
