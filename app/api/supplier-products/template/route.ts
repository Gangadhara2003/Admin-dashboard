import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

// GET — Download Excel template with sample data
export async function GET() {
  try {
    const headers = [
      'Product Name',
      'SKU Code',
      'Unit',
      'Brand',
      'Category',
      'Quantity',
      'MRP (₹)',
      'Selling Price (₹)',
    ];

    const sampleData = [
      {
        'Product Name': 'TMT Steel Bars 12mm',
        'SKU Code': 'TMT-12-500',
        'Unit': 'tons',
        'Brand': 'Tata Tiscon',
        'Category': 'Steel',
        'Quantity': 100,
        'MRP (₹)': 65000,
        'Selling Price (₹)': 58000,
      },
      {
        'Product Name': 'OPC 53 Grade Cement',
        'SKU Code': 'CEM-OPC53-50',
        'Unit': 'bags',
        'Brand': 'UltraTech',
        'Category': 'Cement',
        'Quantity': 500,
        'MRP (₹)': 470,
        'Selling Price (₹)': 420,
      },
      {
        'Product Name': 'River Sand Fine',
        'SKU Code': 'SND-RVR-F',
        'Unit': 'tons',
        'Brand': '',
        'Category': 'Sand & Aggregates',
        'Quantity': 50,
        'MRP (₹)': 3200,
        'Selling Price (₹)': 2800,
      },
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(sampleData, { header: headers });

    // Set column widths
    ws['!cols'] = [
      { wch: 28 }, // Product Name
      { wch: 18 }, // SKU Code
      { wch: 10 }, // Unit
      { wch: 18 }, // Brand
      { wch: 20 }, // Category
      { wch: 12 }, // Quantity
      { wch: 14 }, // MRP
      { wch: 18 }, // Selling Price
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Products');

    // Add instructions sheet
    const instructionData = [
      { 'Field': 'Product Name', 'Required': 'Yes', 'Description': 'Name of the product (e.g., TMT Steel Bars 12mm)' },
      { 'Field': 'SKU Code', 'Required': 'Yes', 'Description': 'Unique SKU identifier for this product (e.g., TMT-12-500)' },
      { 'Field': 'Unit', 'Required': 'Yes', 'Description': 'Unit of measurement: pcs, kg, bags, tons, sqft, rft' },
      { 'Field': 'Brand', 'Required': 'No', 'Description': 'Brand name (optional)' },
      { 'Field': 'Category', 'Required': 'No', 'Description': 'Product category (e.g., Steel, Cement, Sand)' },
      { 'Field': 'Quantity', 'Required': 'Yes', 'Description': 'Available stock quantity (numeric)' },
      { 'Field': 'MRP (₹)', 'Required': 'No', 'Description': 'Maximum Retail Price in INR (numeric, optional)' },
      { 'Field': 'Selling Price (₹)', 'Required': 'Yes', 'Description': 'Your selling price in INR (numeric)' },
    ];
    const wsInstructions = XLSX.utils.json_to_sheet(instructionData);
    wsInstructions['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 55 }];
    XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="VCNITI_Product_Upload_Template.xlsx"',
      },
    });
  } catch (error: any) {
    console.error('Template generation error:', error.message);
    return NextResponse.json({ error: 'Failed to generate template' }, { status: 500 });
  }
}
