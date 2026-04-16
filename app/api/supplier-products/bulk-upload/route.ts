import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import dbConnect from '@/lib/db';
import SupplierProduct from '@/models/SupplierProduct';
import Notification from '@/models/Notification';
import { getUserFromRequest } from '@/lib/auth';
import { getShopifyClient } from '@/lib/shopifyClient';

interface ParsedProduct {
  productName: string;
  skuCode: string;
  unit: string;
  brand: string;
  category: string;
  quantity: number;
  mrp: number;
  sellingPrice: number;
  row: number;
  error?: string;
}

interface UploadResult {
  newProducts: ParsedProduct[];
  duplicates: ParsedProduct[];
  existingInCatalog: (ParsedProduct & { shopifyMatch?: any })[];
  errors: (ParsedProduct & { error: string })[];
}

// Fetch ALL Shopify products using GraphQL (same pattern as /api/shopify/products)
async function fetchAllShopifyProducts(): Promise<any[]> {
  try {
    const client = getShopifyClient();
    const allProducts: any[] = [];
    let hasNextPage = true;
    let endCursor: string | null = null;

    while (hasNextPage && allProducts.length < 500) {
      const afterCursor = endCursor ? `, after: "${endCursor}"` : '';
      const gqlQuery = `query {
        products(first: 250, sortKey: TITLE${afterCursor}) {
          pageInfo { hasNextPage endCursor }
          edges {
            node {
              id title vendor
              variants(first: 10) { edges { node { id title price sku selectedOptions { name value } } } }
              images(first: 1) {
                edges { node { url: url(transform: {maxWidth: 500}) altText } }
              }
            }
          }
        }
      }`;

      const res = await client.post('/graphql.json', { query: gqlQuery });
      if (res.data?.errors) {
        console.error('[Shopify Fetch] GraphQL errors:', JSON.stringify(res.data.errors));
        break;
      }

      const edges = res.data?.data?.products?.edges || [];
      const pageInfo = res.data?.data?.products?.pageInfo;

      for (const edge of edges) {
        const n = edge.node;
        const firstImage = n.images?.edges?.[0]?.node?.url || '';
        allProducts.push({
          id: n.id?.split('/')?.pop() || n.id,
          title: n.title,
          vendor: n.vendor,
          image: firstImage,
          variants: n.variants?.edges?.map((v: any) => ({
            id: v.node.id?.split('/')?.pop() || v.node.id,
            title: v.node.title,
            price: v.node.price,
            sku: v.node.sku,
            selectedOptions: v.node.selectedOptions,
          })) || [],
        });
      }

      console.log(`[Shopify Fetch] Got ${edges.length} products (total: ${allProducts.length})`);
      hasNextPage = pageInfo?.hasNextPage || false;
      endCursor = pageInfo?.endCursor || null;
    }

    console.log(`[Shopify Fetch] Total: ${allProducts.length} products loaded`);
    return allProducts;
  } catch (err: any) {
    console.error('[Shopify Fetch] Error:', err?.message || err);
    return [];
  }
}

// Extract significant keywords from a string
function extractKeywords(text: string): string[] {
  const skipWords = new Set(['the', 'and', 'for', 'with', 'from', 'grade', 'type', 'size', 'pack', 'set', 'box', 'nos', 'per', 'qty']);
  return (text || '')
    .toLowerCase()
    .trim()
    .split(/[\s\-\/,.()\[\]]+/)
    .filter(w => w.length > 2 && !skipWords.has(w));
}

// Split name into words (preserving order, lowercased)
function getWords(text: string): string[] {
  return (text || '').toLowerCase().trim().split(/[\s\-\/,.()\[\]]+/).filter(w => w.length > 0);
}

// Check if a Shopify title contains a prefix phrase (all words in order or as substring)
function titleMatchesPrefix(shopTitleLower: string, prefixWords: string[]): boolean {
  const prefix = prefixWords.join(' ');
  return shopTitleLower.includes(prefix);
}

// Match a single uploaded product against the full Shopify catalog
// Strategy: exact → progressive prefix narrowing → keyword fallback
function findShopifyMatches(productName: string, brand: string, shopifyProducts: any[]): any[] {
  const nameLower = productName.toLowerCase().trim();
  const nameWords = getWords(productName);
  const nameKW = extractKeywords(productName);
  const MAX_RESULTS = 3;

  // ── Step 1: Exact name match ──
  const exactMatches = shopifyProducts.filter(sp =>
    (sp.title || '').toLowerCase().trim() === nameLower
  );
  if (exactMatches.length > 0) {
    console.log(`[Match] EXACT ${exactMatches.length} match(es) for "${productName}"`);
    return exactMatches;
  }

  // ── Step 2: Progressive prefix narrowing ──
  // Start with first 2 words, if too many matches (>MAX_RESULTS) add more words to narrow down
  if (nameWords.length >= 2) {
    let prefixLen = 2;
    let prefixMatches: any[] = [];

    // First check if 2-word prefix has ANY matches
    const twoWordPrefix = nameWords.slice(0, 2);
    const initialMatches = shopifyProducts.filter(sp =>
      titleMatchesPrefix((sp.title || '').toLowerCase().trim(), twoWordPrefix)
    );

    if (initialMatches.length > 0) {
      prefixMatches = initialMatches;

      // If too many matches, progressively add more words to narrow
      while (prefixMatches.length > MAX_RESULTS && prefixLen < nameWords.length) {
        prefixLen++;
        const longerPrefix = nameWords.slice(0, prefixLen);
        const narrowed = shopifyProducts.filter(sp =>
          titleMatchesPrefix((sp.title || '').toLowerCase().trim(), longerPrefix)
        );
        // Only narrow if we still have results; otherwise keep previous set
        if (narrowed.length > 0) {
          prefixMatches = narrowed;
        } else {
          break;
        }
      }

      console.log(`[Match] PREFIX(${prefixLen} words) ${prefixMatches.length} match(es) for "${productName}": ${prefixMatches.map(m => `"${m.title}"`).join(', ')}`);
      return prefixMatches;
    }
    // If 2-word prefix found nothing, fall through to keyword search
  }

  // ── Step 3: Keyword fallback (unordered matching) ──
  // At least 2 keyword hits required
  if (nameKW.length >= 2) {
    const kwMatches: { sp: any; hits: number }[] = [];
    for (const sp of shopifyProducts) {
      const shopKW = extractKeywords(sp.title || '');
      if (shopKW.length < 2) continue;
      const hits = nameKW.filter(kw => shopKW.some(sk => sk.includes(kw) || kw.includes(sk))).length;
      if (hits >= 2) {
        kwMatches.push({ sp, hits });
      }
    }

    if (kwMatches.length > 0) {
      // Sort by most keyword hits first, return top results
      kwMatches.sort((a, b) => b.hits - a.hits);
      const results = kwMatches.slice(0, MAX_RESULTS * 2).map(m => m.sp);
      console.log(`[Match] KEYWORD ${results.length} match(es) for "${productName}": ${results.map(m => `"${m.title}"`).join(', ')}`);
      return results;
    }
  }

  console.log(`[Match] NO MATCH for: "${productName}" (brand="${brand}") | words: [${nameWords}]`);
  return [];
}

// POST — Parse Excel and detect duplicates
export async function POST(req: Request) {
  try {
    await dbConnect();
    const user = getUserFromRequest(req);
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const action = formData.get('action') as string | null; // 'preview' or 'submit'

    // Admin can upload on behalf of a supplier
    const targetSupplierId = formData.get('supplierId') as string | null;
    const effectiveUserId = (user.role === 'admin' && targetSupplierId) ? targetSupplierId : user.id;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Parse Excel
    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) {
      return NextResponse.json({ error: 'Empty spreadsheet' }, { status: 400 });
    }

    const rawData: any[] = XLSX.utils.sheet_to_json(ws);
    if (rawData.length === 0) {
      return NextResponse.json({ error: 'No data rows found in the spreadsheet' }, { status: 400 });
    }

    // Parse and validate rows
    const parsedProducts: ParsedProduct[] = [];
    const errors: (ParsedProduct & { error: string })[] = [];

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      const productName = (row['Product Name'] || row['product name'] || row['Name'] || row['name'] || '').toString().trim();
      const skuCode = (row['SKU Code'] || row['sku code'] || row['SKU'] || row['sku'] || '').toString().trim();
      const unit = (row['Unit'] || row['unit'] || 'pcs').toString().trim().toLowerCase();
      const brand = (row['Brand'] || row['brand'] || '').toString().trim();
      const category = (row['Category'] || row['category'] || '').toString().trim();
      const quantity = Number(row['Quantity'] || row['quantity'] || 0);
      const mrp = Number(row['MRP (₹)'] || row['MRP'] || row['mrp'] || 0);
      const sellingPrice = Number(row['Selling Price (₹)'] || row['Selling Price'] || row['selling price'] || row['Price'] || row['price'] || 0);

      const parsed: ParsedProduct = { productName, skuCode, unit, brand, category, quantity, mrp, sellingPrice, row: i + 2 };

      // Validate required fields
      if (!productName) {
        errors.push({ ...parsed, error: 'Product Name is required' });
        continue;
      }
      if (!skuCode) {
        errors.push({ ...parsed, error: 'SKU Code is required' });
        continue;
      }
      if (quantity < 0 || isNaN(quantity)) {
        errors.push({ ...parsed, error: 'Quantity must be a non-negative number' });
        continue;
      }
      if (sellingPrice <= 0 || isNaN(sellingPrice)) {
        errors.push({ ...parsed, error: 'Selling Price must be a positive number' });
        continue;
      }

      parsedProducts.push(parsed);
    }

    // Check for duplicate SKU codes within the upload
    const skuSet = new Set<string>();
    const internalDuplicates: (ParsedProduct & { error: string })[] = [];
    const uniqueProducts: ParsedProduct[] = [];
    for (const p of parsedProducts) {
      if (skuSet.has(p.skuCode.toLowerCase())) {
        internalDuplicates.push({ ...p, error: `Duplicate SKU "${p.skuCode}" in uploaded file` });
      } else {
        skuSet.add(p.skuCode.toLowerCase());
        uniqueProducts.push(p);
      }
    }
    errors.push(...internalDuplicates);

    // Check against existing supplier products (already in their catalog)
    const existingProducts = await SupplierProduct.find({
      supplierId: effectiveUserId,
      status: { $in: ['pending', 'approved'] },
    }).lean();

    const existingSKUs = new Set(existingProducts.map((p: any) => (p.skuCode || '').toLowerCase()).filter(Boolean));
    const existingNames = new Set(existingProducts.map((p: any) => {
      const name = p.source === 'catalog' ? p.shopifyTitle : p.productName;
      return (name || '').toLowerCase().trim();
    }).filter(Boolean));

    const newProducts: ParsedProduct[] = [];
    const duplicates: ParsedProduct[] = [];

    for (const p of uniqueProducts) {
      const skuExists = existingSKUs.has(p.skuCode.toLowerCase());
      const nameExists = existingNames.has(p.productName.toLowerCase());
      if (skuExists || nameExists) {
        duplicates.push(p);
      } else {
        newProducts.push(p);
      }
    }

    // Check Shopify catalog — fetch ALL products once, match locally
    const shopifyProducts = await fetchAllShopifyProducts();
    const existingInCatalog: (ParsedProduct & { shopifyMatch?: any; shopifyMatches?: any[] })[] = [];
    const trulyNew: ParsedProduct[] = [];

    for (const p of newProducts) {
      const matches = findShopifyMatches(p.productName, p.brand, shopifyProducts);
      if (matches.length > 0) {
        existingInCatalog.push({
          ...p,
          shopifyMatch: { id: matches[0].id, title: matches[0].title, image: matches[0].image, variants: matches[0].variants },
          shopifyMatches: matches.map(m => ({ id: m.id, title: m.title, vendor: m.vendor, image: m.image, variants: m.variants })),
        });
      } else {
        trulyNew.push(p);
      }
    }

    const result: UploadResult = {
      newProducts: trulyNew,
      duplicates,
      existingInCatalog,
      errors,
    };

    // If action is 'submit', actually create the products
    if (action === 'submit') {
      const supplierName = formData.get('supplierName') as string || 'Supplier';
      const catalogVariantsRaw = formData.get('catalogVariants') as string || '{}';
      let catalogVariantsMap: Record<number, any[]> = {};
      try { catalogVariantsMap = JSON.parse(catalogVariantsRaw); } catch {}
      const editedNewRaw = formData.get('editedNewProducts') as string || '{}';
      let editedNewMap: Record<number, { quantity?: string; sellingPrice?: string; mrp?: string }> = {};
      try { editedNewMap = JSON.parse(editedNewRaw); } catch {}
      const createdProducts: any[] = [];

      // Create new products
      for (const p of trulyNew) {
        const edits = editedNewMap[p.row];
        const qty = edits?.quantity !== undefined ? Number(edits.quantity) : p.quantity;
        const price = edits?.sellingPrice !== undefined ? Number(edits.sellingPrice) : p.sellingPrice;
        const mrp = edits?.mrp !== undefined ? Number(edits.mrp) : p.mrp;
        const product = await SupplierProduct.create({
          supplierId: effectiveUserId,
          supplierName,
          source: 'bulk_upload',
          productName: p.productName,
          skuCode: p.skuCode,
          productUnit: p.unit,
          brand: p.brand,
          productCategory: p.category,
          quantity: qty,
          mrp: mrp || undefined,
          sellingPrice: price,
          availability: qty > 0 ? 'available' : 'out_of_stock',
          status: 'pending',
          stockAdjustmentLog: [{
            reason: 'new_stock_received',
            note: 'Initial stock from bulk upload',
            previousQty: 0,
            newQty: qty,
            adjustedBy: supplierName,
            timestamp: new Date(),
          }],
        });
        createdProducts.push(product);
      }

      // Create products that match Shopify catalog (with shopifyProductId link)
      for (const p of existingInCatalog) {
        // Build variant array from supplier-provided variant details
        const rowVariants = catalogVariantsMap[p.row] || [];
        const filledVariants = rowVariants.filter((v: any) => v.quantity > 0 || v.sellingPrice > 0);
        const totalQty = filledVariants.length > 0
          ? filledVariants.reduce((sum: number, v: any) => sum + (Number(v.quantity) || 0), 0)
          : p.quantity;
        const avgPrice = filledVariants.length > 0
          ? Math.round(filledVariants.reduce((sum: number, v: any) => sum + (Number(v.sellingPrice) || 0), 0) / filledVariants.length)
          : p.sellingPrice;

        const product = await SupplierProduct.create({
          supplierId: effectiveUserId,
          supplierName,
          source: 'catalog',
          shopifyProductId: p.shopifyMatch?.id?.toString() || '',
          shopifyTitle: p.shopifyMatch?.title || p.productName,
          shopifyImage: p.shopifyMatch?.image || '',
          productName: p.productName,
          skuCode: p.skuCode,
          productUnit: p.unit,
          brand: p.brand,
          productCategory: p.category,
          quantity: totalQty,
          mrp: p.mrp || undefined,
          sellingPrice: avgPrice,
          variants: filledVariants.map((v: any) => ({
            variantId: v.variantId || '',
            title: v.title || 'Default',
            sku: v.sku || '',
            shopifyPrice: v.shopifyPrice || '',
            color: v.color || '',
            quantity: Number(v.quantity) || 0,
            sellingPrice: Number(v.sellingPrice) || 0,
          })),
          availability: totalQty > 0 ? 'available' : 'out_of_stock',
          status: 'pending',
          stockAdjustmentLog: [{
            reason: 'new_stock_received',
            note: 'Initial stock from bulk upload (Shopify catalog match)',
            previousQty: 0,
            newQty: totalQty,
            adjustedBy: supplierName,
            timestamp: new Date(),
          }],
        });
        createdProducts.push(product);
      }

      // Update existing products (duplicates)
      for (const p of duplicates) {
        const existing = await SupplierProduct.findOne({
          supplierId: effectiveUserId,
          $or: [
            { skuCode: { $regex: new RegExp(`^${p.skuCode}$`, 'i') } },
            { productName: { $regex: new RegExp(`^${p.productName}$`, 'i') } },
            { shopifyTitle: { $regex: new RegExp(`^${p.productName}$`, 'i') } },
          ],
          status: { $in: ['pending', 'approved'] },
        });

        if (existing) {
          const prevQty = existing.quantity;
          existing.quantity = p.quantity;
          existing.sellingPrice = p.sellingPrice;
          if (p.mrp) existing.mrp = p.mrp;
          if (p.brand) existing.brand = p.brand;
          if (p.category) existing.productCategory = p.category;
          if (p.unit) existing.productUnit = p.unit;
          existing.availability = p.quantity > 0 ? 'available' : 'out_of_stock';
          existing.stockAdjustmentLog.push({
            reason: 'correction',
            note: 'Updated via bulk upload',
            previousQty: prevQty,
            newQty: p.quantity,
            adjustedBy: supplierName,
            timestamp: new Date(),
          });
          await existing.save();
        }
      }

      // Notify admin
      await Notification.create({
        type: 'product_request',
        title: 'Bulk Product Upload',
        message: `${supplierName} uploaded ${createdProducts.length} new products and updated ${duplicates.length} existing products via bulk upload.`,
        to: 'admin',
        link: '/admin/products',
        data: {
          newCount: createdProducts.length,
          updatedCount: duplicates.length,
          errorCount: errors.length,
        },
      });

      return NextResponse.json({
        success: true,
        created: createdProducts.length,
        updated: duplicates.length,
        errors: errors.length,
        result,
      }, { status: 201 });
    }

    // Preview mode — just return parsed data
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error('Bulk upload error:', error.message);
    return NextResponse.json({ error: 'Failed to process upload: ' + error.message }, { status: 500 });
  }
}
