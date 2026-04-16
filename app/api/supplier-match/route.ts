import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import SupplierProduct from '@/models/SupplierProduct';
import Supplier from '@/models/Supplier';

// POST — match order line items to suppliers with zone-based filtering
export async function POST(req: Request) {
  try {
    await dbConnect();
    const body = await req.json();
    const { productNames, deliveryPincode } = body;

    if (!productNames || !Array.isArray(productNames) || productNames.length === 0) {
      return NextResponse.json({ error: 'productNames array is required' }, { status: 400 });
    }

    // Get all approved supplier products
    const supplierProducts = await SupplierProduct.find({ status: 'approved' }).lean();

    // If deliveryPincode provided, load supplier zone data for filtering
    let supplierZoneMap: Record<string, { servicePincodes: string[]; pincode: string }> = {};
    if (deliveryPincode) {
      const allSupplierIds = [...new Set(supplierProducts.map(sp => sp.supplierId.toString()))];
      const suppliers = await Supplier.find({ _id: { $in: allSupplierIds }, isActive: true })
        .select('servicePincodes pincode')
        .lean();
      for (const s of suppliers) {
        supplierZoneMap[s._id.toString()] = {
          servicePincodes: s.servicePincodes || [],
          pincode: s.pincode || '',
        };
      }
    }

    // For each order product, find matching supplier products using fuzzy matching
    const matches: Record<string, { supplierId: string; supplierName: string; productTitle: string; sellingPrice: number }[]> = {};

    for (const name of productNames) {
      const nameLower = name.toLowerCase().trim();
      matches[name] = [];

      for (const sp of supplierProducts) {
        const spTitle = (sp.source === 'catalog' ? sp.shopifyTitle : sp.productName) || '';
        const spTitleLower = spTitle.toLowerCase().trim();

        if (
          spTitleLower.includes(nameLower) ||
          nameLower.includes(spTitleLower) ||
          wordMatchScore(nameLower, spTitleLower) >= 0.6
        ) {
          matches[name].push({
            supplierId: sp.supplierId.toString(),
            supplierName: sp.supplierName || '',
            productTitle: spTitle,
            sellingPrice: sp.sellingPrice || 0,
          });
        }
      }
    }

    // Group by supplier
    const supplierMap: Record<string, {
      supplierId: string;
      supplierName: string;
      matchedProducts: { orderProduct: string; supplierProduct: string; price: number }[];
    }> = {};

    for (const [orderProduct, productMatches] of Object.entries(matches)) {
      for (const m of productMatches) {
        if (!supplierMap[m.supplierId]) {
          supplierMap[m.supplierId] = {
            supplierId: m.supplierId,
            supplierName: m.supplierName,
            matchedProducts: [],
          };
        }
        if (!supplierMap[m.supplierId].matchedProducts.find(mp => mp.orderProduct === orderProduct)) {
          supplierMap[m.supplierId].matchedProducts.push({
            orderProduct,
            supplierProduct: m.productTitle,
            price: m.sellingPrice,
          });
        }
      }
    }

    // Enrich with supplier details
    const supplierIds = Object.keys(supplierMap);
    const supplierDetails = await Supplier.find({ _id: { $in: supplierIds } })
      .select('name businessName phone pincode servicePincodes')
      .lean();
    const detailMap: Record<string, any> = {};
    for (const s of supplierDetails) {
      detailMap[s._id.toString()] = s;
    }

    let suggestions = Object.values(supplierMap).map(s => {
      const detail = detailMap[s.supplierId];
      const zoneMatch = deliveryPincode ? getPincodeProximity(deliveryPincode, detail) : 'none';
      return {
        ...s,
        supplierName: detail?.businessName || detail?.name || s.supplierName,
        phone: detail?.phone || '',
        pincode: detail?.pincode || '',
        zoneMatch,
      };
    });

    // Sort: zone-matched first (exact > zone > none), then by product count
    if (deliveryPincode) {
      const zonePriority: Record<string, number> = { exact: 0, zone: 1, none: 2 };
      suggestions.sort((a, b) => {
        const zoneDiff = (zonePriority[a.zoneMatch] ?? 2) - (zonePriority[b.zoneMatch] ?? 2);
        if (zoneDiff !== 0) return zoneDiff;
        return b.matchedProducts.length - a.matchedProducts.length;
      });
    } else {
      suggestions.sort((a, b) => b.matchedProducts.length - a.matchedProducts.length);
    }

    const unmatchedProducts = productNames.filter(name => !matches[name] || matches[name].length === 0);

    return NextResponse.json({ suggestions, unmatchedProducts });
  } catch (error: any) {
    console.error('Supplier match error:', error.message);
    return NextResponse.json({ error: 'Failed to match suppliers' }, { status: 500 });
  }
}

/**
 * Determine how close a supplier is to the delivery pincode.
 * - "exact": supplier's servicePincodes includes the delivery pincode
 * - "zone": first 3 digits match (same postal zone in India)
 * - "none": no zone overlap
 */
function getPincodeProximity(deliveryPincode: string, supplier: any): 'exact' | 'zone' | 'none' {
  const dp = deliveryPincode.trim();
  const servicePins: string[] = supplier?.servicePincodes || [];

  // Exact match: delivery pincode is in the supplier's service list
  if (servicePins.some(pin => pin.trim() === dp)) {
    return 'exact';
  }

  // Zone match: first 3 digits match (same postal district)
  const dpZone = dp.slice(0, 3);
  const supplierPincode = supplier?.pincode?.trim() || '';
  if (supplierPincode && supplierPincode.slice(0, 3) === dpZone) {
    return 'zone';
  }
  if (servicePins.some(pin => pin.trim().slice(0, 3) === dpZone)) {
    return 'zone';
  }

  return 'none';
}

function wordMatchScore(a: string, b: string): number {
  const wordsA = a.split(/\s+/).filter(w => w.length > 2);
  const wordsB = b.split(/\s+/).filter(w => w.length > 2);
  if (wordsA.length === 0 || wordsB.length === 0) return 0;
  const matchingWords = wordsA.filter(wa => wordsB.some(wb => wb.includes(wa) || wa.includes(wb)));
  return matchingWords.length / Math.max(wordsA.length, wordsB.length);
}
