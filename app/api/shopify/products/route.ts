import { NextResponse } from 'next/server';
import { getShopifyClient, parseGid } from '@/lib/shopifyClient';
import { getUserFromRequest } from '@/lib/auth';
import { getCache, setCache, invalidateCache, CACHE_KEYS } from '@/lib/redis';

export async function GET() {
  try {
    // Check Redis cache first
    const cached = await getCache(CACHE_KEYS.SHOPIFY_PRODUCTS);
    if (cached) {
      return NextResponse.json(cached);
    }

    const shopify = getShopifyClient();

    let allEdges: any[] = [];
    let hasNextPage = true;
    let endCursor = null;

    // Shopify GraphQL max returned per query is 250. 
    // We loop incrementally until we hit our target max (e.g. 500) or run out of pages.
    while (hasNextPage && allEdges.length < 500) {
      const fetchLimit = Math.min(250, 500 - allEdges.length);
      const afterCursor: string = endCursor ? `, after: "${endCursor}"` : ``;

      const gqlQuery = `
      query {
        products(first: ${fetchLimit}, sortKey: CREATED_AT, reverse: true${afterCursor}) {
          pageInfo { hasNextPage endCursor }
          edges {
            node {
              id title handle status vendor productType tags createdAt updatedAt
              totalInventory
              options { name values }
              variants(first: 50) {
                edges {
                  node {
                    id price compareAtPrice sku inventoryQuantity title
                    selectedOptions { name value }
                  }
                }
              }
              images(first: 5) {
                edges { node { url: url(transform: {maxWidth: 500}) altText } }
              }
            }
          }
        }
      }`;

      const response = await shopify.post('/graphql.json', { query: gqlQuery });

      if (response.data.errors) {
        console.error('GraphQL Errors:', JSON.stringify(response.data.errors));
        return NextResponse.json({ error: 'GraphQL Error' }, { status: 500 });
      }

      const pageInfo = response.data.data.products?.pageInfo;
      const edges = response.data.data.products?.edges || [];
      
      allEdges = [...allEdges, ...edges];
      hasNextPage = pageInfo?.hasNextPage || false;
      endCursor = pageInfo?.endCursor || null;
    }

    const products = allEdges.map((edge: any) => {
      const n = edge.node;
      return {
        id: parseGid(n.id),
        gid: n.id,
        title: n.title,
        handle: n.handle,
        status: n.status?.toLowerCase() || 'active',
        vendor: n.vendor,
        product_type: n.productType,
        tags: n.tags,
        created_at: n.createdAt,
        updated_at: n.updatedAt,
        total_inventory: n.totalInventory,
        options: n.options,
        variants: n.variants.edges.map((v: any) => ({
          id: parseGid(v.node.id),
          price: v.node.price,
          compare_at_price: v.node.compareAtPrice,
          sku: v.node.sku,
          inventory_quantity: v.node.inventoryQuantity,
          title: v.node.title,
          selectedOptions: v.node.selectedOptions,
        })),
        images: n.images.edges.map((i: any) => ({
          src: i.node.url,
          alt: i.node.altText,
        })),
      };
    });

    const responseData = {
      products,
      nextCursor: endCursor,
      hasNextPage: hasNextPage,
      totalCount: products.length,
    };

    // Cache for 1 hour
    await setCache(CACHE_KEYS.SHOPIFY_PRODUCTS, responseData);

    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error('Shopify Products Error:', error.response?.data || error.message);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

/** POST — Create a new product on Shopify (ADMIN ONLY, always DRAFT status) */
export async function POST(req: Request) {
  try {
    const user = getUserFromRequest(req);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized — admin only' }, { status: 401 });
    }

    const shopify = getShopifyClient();
    const body = await req.json();

    const product: any = {
      title: body.title,
      body_html: body.description || '',
      vendor: body.vendor || '',
      product_type: body.product_type || '',
      tags: body.tags || '',
      status: 'draft', // ⚠️ ALWAYS draft — never auto-publish
    };

    if (body.variants && body.variants.length > 0) {
      product.variants = body.variants.map((v: any) => ({
        price: v.price || '0',
        compare_at_price: v.compare_at_price || null,
        sku: v.sku || '',
        inventory_management: 'shopify',
        inventory_quantity: v.inventory_quantity || 0,
        title: v.title || 'Default Title',
        option1: v.option1 || null,
        option2: v.option2 || null,
        option3: v.option3 || null,
      }));
    } else {
      product.variants = [{
        price: body.price || '0',
        compare_at_price: body.compare_at_price || null,
        sku: body.sku || '',
        inventory_management: 'shopify',
        inventory_quantity: body.inventory_quantity || 0,
      }];
    }

    if (body.options && body.options.length > 0) {
      product.options = body.options;
    }

    if (body.images && body.images.length > 0) {
      product.images = body.images.map((img: any) => ({
        src: typeof img === 'string' ? img : img.src,
        alt: typeof img === 'string' ? '' : img.alt || '',
      }));
    }

    const response = await shopify.post('/products.json', { product });

    // Invalidate product cache on create
    await invalidateCache(CACHE_KEYS.SHOPIFY_PRODUCTS);
    await invalidateCache(CACHE_KEYS.SHOPIFY_ANALYTICS);
    await invalidateCache(CACHE_KEYS.SHOPIFY_INVENTORY);

    return NextResponse.json({
      success: true,
      product: response.data.product,
      message: 'Product created as DRAFT. Go to Shopify admin to activate.',
    }, { status: 201 });
  } catch (error: any) {
    console.error('Shopify Create Product Error:', error.response?.data || error.message);
    return NextResponse.json({ error: error.response?.data?.errors || 'Failed to create product' }, { status: 500 });
  }
}

/** PUT — Update an existing Shopify product (ADMIN ONLY, cannot set status to active) */
export async function PUT(req: Request) {
  try {
    const user = getUserFromRequest(req);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized — admin only' }, { status: 401 });
    }

    const shopify = getShopifyClient();
    const body = await req.json();
    const { product_id } = body;

    if (!product_id) {
      return NextResponse.json({ error: 'product_id is required' }, { status: 400 });
    }

    const update: any = {};
    if (body.title !== undefined) update.title = body.title;
    if (body.description !== undefined) update.body_html = body.description;
    if (body.vendor !== undefined) update.vendor = body.vendor;
    if (body.product_type !== undefined) update.product_type = body.product_type;
    if (body.tags !== undefined) update.tags = body.tags;

    // ⚠️ Status can only be set to draft, not active from dashboard
    if (body.status !== undefined) {
      update.status = body.status === 'active' ? 'draft' : body.status;
    }

    if (body.variants) update.variants = body.variants;
    if (body.images) update.images = body.images.map((img: any) => ({
      src: typeof img === 'string' ? img : img.src,
      alt: typeof img === 'string' ? '' : img.alt || '',
    }));

    const response = await shopify.put(`/products/${product_id}.json`, { product: update });

    // Invalidate product cache on update
    await invalidateCache(CACHE_KEYS.SHOPIFY_PRODUCTS);
    await invalidateCache(CACHE_KEYS.SHOPIFY_ANALYTICS);

    return NextResponse.json({ success: true, product: response.data.product });
  } catch (error: any) {
    console.error('Shopify Update Product Error:', error.response?.data || error.message);
    return NextResponse.json({ error: error.response?.data?.errors || 'Failed to update product' }, { status: 500 });
  }
}

/** DELETE — Delete a Shopify product (ADMIN ONLY) */
export async function DELETE(req: Request) {
  try {
    const user = getUserFromRequest(req);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized — admin only' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const productId = searchParams.get('id');
    if (!productId) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    const shopify = getShopifyClient();
    await shopify.delete(`/products/${productId}.json`);

    // Invalidate product cache on delete
    await invalidateCache(CACHE_KEYS.SHOPIFY_PRODUCTS);
    await invalidateCache(CACHE_KEYS.SHOPIFY_ANALYTICS);
    await invalidateCache(CACHE_KEYS.SHOPIFY_INVENTORY);

    return NextResponse.json({ success: true, message: 'Product deleted' });
  } catch (error: any) {
    console.error('Shopify Delete Product Error:', error.response?.data || error.message);
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
  }
}
