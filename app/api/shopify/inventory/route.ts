import { NextResponse } from 'next/server';
import { getShopifyClient, parseGid } from '@/lib/shopifyClient';
import { getCache, setCache, invalidateCache, CACHE_KEYS } from '@/lib/redis';

export async function GET() {
  try {
    // Check Redis cache first
    const cached = await getCache(CACHE_KEYS.SHOPIFY_INVENTORY);
    if (cached) {
      return NextResponse.json(cached);
    }

    const shopify = getShopifyClient();

    const gqlQuery = `
    query {
      productVariants(first: 100) {
        edges {
          node {
            id
            title
            sku
            inventoryQuantity
            price
            product {
              id
              title
              vendor
              productType
              status
              images(first: 1) {
                edges { node { url: url(transform: {maxWidth: 200}) } }
              }
            }
            inventoryItem {
              id
              tracked
            }
          }
        }
      }
    }`;

    const response = await shopify.post('/graphql.json', { query: gqlQuery });

    if (response.data.errors) {
      return NextResponse.json({ error: 'GraphQL Error' }, { status: 500 });
    }

    const edges = response.data.data.productVariants?.edges || [];

    const inventory = edges.map((edge: any) => {
      const v = edge.node;
      return {
        variant_id: parseGid(v.id),
        variant_title: v.title,
        sku: v.sku,
        inventory_quantity: v.inventoryQuantity,
        price: v.price,
        tracked: v.inventoryItem?.tracked || false,
        inventory_item_id: parseGid(v.inventoryItem?.id),
        product_id: parseGid(v.product?.id),
        product_title: v.product?.title,
        vendor: v.product?.vendor,
        product_type: v.product?.productType,
        status: v.product?.status?.toLowerCase(),
        image: v.product?.images?.edges?.[0]?.node?.url || null,
      };
    });

    const totalItems = inventory.length;
    const lowStock = inventory.filter((i: any) => i.inventory_quantity > 0 && i.inventory_quantity <= 10).length;
    const outOfStock = inventory.filter((i: any) => i.inventory_quantity <= 0).length;
    const inStock = inventory.filter((i: any) => i.inventory_quantity > 0).length;

    const responseData = {
      inventory,
      stats: { totalItems, lowStock, outOfStock, inStock },
    };

    // Cache for 1 hour
    await setCache(CACHE_KEYS.SHOPIFY_INVENTORY, responseData);

    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error('Shopify Inventory Error:', error.response?.data || error.message);
    return NextResponse.json({ error: 'Failed to fetch inventory' }, { status: 500 });
  }
}

/** PUT — Adjust inventory level */
export async function PUT(req: Request) {
  try {
    const shopify = getShopifyClient();
    const body = await req.json();
    const { inventory_item_id, available_adjustment, location_id } = body;

    if (!inventory_item_id || available_adjustment === undefined) {
      return NextResponse.json({ error: 'inventory_item_id and available_adjustment required' }, { status: 400 });
    }

    // Get default location if not provided
    let targetLocationId = location_id;
    if (!targetLocationId) {
      const locRes = await shopify.get('/locations.json');
      targetLocationId = locRes.data.locations?.[0]?.id;
    }

    const response = await shopify.post('/inventory_levels/adjust.json', {
      location_id: targetLocationId,
      inventory_item_id,
      available_adjustment,
    });

    // Invalidate inventory cache on adjustment
    await invalidateCache(CACHE_KEYS.SHOPIFY_INVENTORY);
    await invalidateCache(CACHE_KEYS.SHOPIFY_PRODUCTS);

    return NextResponse.json({ success: true, inventory_level: response.data.inventory_level });
  } catch (error: any) {
    console.error('Shopify Inventory Adjust Error:', error.response?.data || error.message);
    return NextResponse.json({ error: 'Failed to adjust inventory' }, { status: 500 });
  }
}
