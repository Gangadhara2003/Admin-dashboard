import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Supplier from '@/models/Supplier';
import SupplierProduct from '@/models/SupplierProduct';
import SupplierOrder from '@/models/SupplierOrder';
import SupplierReturn from '@/models/SupplierReturn';
import PriceRevision from '@/models/PriceRevision';
import { getUserFromRequest } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { sendSupplierNotificationEmail } from '@/lib/email';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getUserFromRequest(req);
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await dbConnect();
    const { id } = await params;
    const supplier = await Supplier.findById(id).select('-passwordHash');
    if (!supplier) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    return NextResponse.json({ supplier }, { status: 200 });
  } catch (error) {
    console.error('Fetch supplier error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getUserFromRequest(req);
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await dbConnect();
    const { id } = await params;
    const body = await req.json();
    const { phone, password, name, businessName, email, address, city, state, pincode, isActive } = body;

    // Get old supplier for email
    const oldSupplier = await Supplier.findById(id).lean();

    let updateData: any = { phone, name, businessName, email, address, city, state, pincode };
    if (isActive !== undefined) updateData.isActive = isActive;
    const passwordChanged = password && password.trim() !== '';
    if (passwordChanged) updateData.passwordHash = await bcrypt.hash(password, 10);
    Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);
    const updated = await Supplier.findByIdAndUpdate(id, updateData, { new: true }).select('-passwordHash');
    if (!updated) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });

    // Cascade name change to all related documents
    if (name && oldSupplier && name !== oldSupplier.name) {
      const nameFilter = { supplierId: id };
      const nameUpdate = { supplierName: name };
      await Promise.all([
        SupplierProduct.updateMany(nameFilter, nameUpdate),
        SupplierOrder.updateMany(nameFilter, nameUpdate),
        SupplierReturn.updateMany(nameFilter, nameUpdate),
        PriceRevision.updateMany(nameFilter, nameUpdate),
      ]);
    }

    // Email supplier if password was changed
    if (passwordChanged && (updated.email || oldSupplier?.email)) {
      const supplierEmail = updated.email || oldSupplier?.email;
      sendSupplierNotificationEmail(
        supplierEmail,
        '🔑 Your Password Has Been Updated',
        `<p>Hi <strong>${updated.name}</strong>,</p>
         <p>Your password has been updated by the admin. If you did not request this change, please contact admin immediately.</p>
         <p style="margin-top: 12px; font-size: 13px; color: #6b7280;">You can log in with your new credentials.</p>`,
        '/supplier/products',
        'Go to Dashboard'
      ).catch(() => {});
    }

    // Email supplier if profile details were changed (not password)
    if (!passwordChanged && (updated.email || oldSupplier?.email)) {
      const changes: string[] = [];
      if (oldSupplier) {
        if (name && name !== oldSupplier.name) changes.push(`Name: ${oldSupplier.name} → ${name}`);
        if (businessName && businessName !== oldSupplier.businessName) changes.push(`Business: ${oldSupplier.businessName} → ${businessName}`);
        if (phone && phone !== oldSupplier.phone) changes.push(`Phone updated`);
        if (isActive !== undefined && isActive !== oldSupplier.isActive) changes.push(`Account ${isActive ? 'activated' : 'deactivated'}`);
      }
      if (changes.length > 0) {
        const supplierEmail = updated.email || oldSupplier?.email;
        sendSupplierNotificationEmail(
          supplierEmail,
          '📝 Your Account Has Been Updated',
          `<p>Hi <strong>${updated.name}</strong>,</p>
           <p>Admin has updated your account details:</p>
           <ul>${changes.map(c => `<li style="font-size: 13px; color: #4b5563;">${c}</li>`).join('')}</ul>`,
          '/supplier/products',
          'View Dashboard'
        ).catch(() => {});
      }
    }

    return NextResponse.json({ message: 'Supplier updated successfully', supplier: updated }, { status: 200 });
  } catch (error: any) {
    console.error('Update supplier error:', error);
    if (error.code === 11000) return NextResponse.json({ error: 'Phone number already in use' }, { status: 400 });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getUserFromRequest(req);
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await dbConnect();
    const { id } = await params;
    const deleted = await Supplier.findByIdAndDelete(id);
    if (!deleted) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    return NextResponse.json({ message: 'Supplier deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error('Delete supplier error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
