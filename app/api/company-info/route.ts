import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import CompanyInfo from '@/models/CompanyInfo';
import { getUserFromRequest } from '@/lib/auth';

// GET — fetch company info (accessible by everyone)
export async function GET() {
  try {
    await dbConnect();
    let info = await CompanyInfo.findOne().lean();
    if (!info) {
      info = await CompanyInfo.create({
        name: 'VCNITI',
        tagline: 'Building Materials & Supply Chain Solutions',
        description: 'VCNITI is a trusted supplier and distributor of building materials, providing seamless supply chain solutions for construction businesses across India.',
        email: 'laxmanrao@vcniti.com',
        phone: '',
        website: 'https://vcniti.com',
        address: '',
        gst: '',
      });
    }
    return NextResponse.json({ info });
  } catch (error) {
    console.error('Company info fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch company info' }, { status: 500 });
  }
}

// PUT — update company info (admin only)
export async function PUT(req: Request) {
  try {
    const user = getUserFromRequest(req);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const body = await req.json();
    const { name, tagline, description, email, phone, website, address, gst, logo } = body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (tagline !== undefined) updateData.tagline = tagline;
    if (description !== undefined) updateData.description = description;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (website !== undefined) updateData.website = website;
    if (address !== undefined) updateData.address = address;
    if (gst !== undefined) updateData.gst = gst;
    if (logo !== undefined) updateData.logo = logo;

    let info = await CompanyInfo.findOne();
    if (info) {
      await CompanyInfo.updateOne({ _id: info._id }, updateData);
      info = await CompanyInfo.findOne();
    } else {
      info = await CompanyInfo.create(updateData);
    }

    return NextResponse.json({ info, message: 'Company info updated' });
  } catch (error) {
    console.error('Company info update error:', error);
    return NextResponse.json({ error: 'Failed to update company info' }, { status: 500 });
  }
}
