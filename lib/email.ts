import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'laxmanrao@vcniti.com';
const ADMIN_URL = process.env.ADMIN_URL || 'https://admin-dashboard-flame-psi-69.vercel.app';
const SUPPLIER_URL = process.env.SUPPLIER_URL || 'https://supplier-dashboard-zeta.vercel.app';

export async function sendProductAddedEmail(product: any, supplier: any): Promise<boolean> {
  const mailOptions = {
    from: `"Supply Dashboard" <${process.env.EMAIL_USER}>`,
    to: ADMIN_EMAIL,
    subject: `New Product Added: ${product.name} by ${supplier.name}`,
    html: `
      <h2>New Product Added</h2>
      <p>A new product has been added to the Supply Dashboard by a supplier.</p>
      <h3>Product Details:</h3>
      <ul>
        <li><strong>Name:</strong> ${product.name}</li>
        <li><strong>Price:</strong> ₹${product.price}</li>
        <li><strong>Stock:</strong> ${product.stock} ${product.unit || 'pcs'}</li>
        <li><strong>Category:</strong> ${product.category || 'N/A'}</li>
      </ul>
      <p><strong>Description:</strong> ${product.description || 'No description provided.'}</p>
      <h3>Supplier Details:</h3>
      <ul>
        <li><strong>Name:</strong> ${supplier.name}</li>
        <li><strong>Business Name:</strong> ${supplier.businessName}</li>
        <li><strong>Phone:</strong> ${supplier.phone}</li>
        <li><strong>Location:</strong> ${supplier.city}, ${supplier.state}</li>
      </ul>
      <p>Log in to the <a href="${ADMIN_URL}/admin/products">Admin Dashboard — Products</a> to view more details.</p>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Product added email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending product added email:', error);
    return false;
  }
}

export async function sendPasswordChangeRequestEmail(supplier: any, reason: string = ''): Promise<boolean> {
  const mailOptions = {
    from: `"Supply Dashboard" <${process.env.EMAIL_USER}>`,
    to: ADMIN_EMAIL,
    subject: `Password Change Request: ${supplier.name}`,
    html: `
      <h2>Password Change Request</h2>
      <p>Supplier <strong>${supplier.name} (${supplier.businessName})</strong> has requested a password change.</p>
      <h3>Supplier Details:</h3>
      <ul>
        <li><strong>Phone (Login ID):</strong> ${supplier.phone}</li>
        <li><strong>Email:</strong> ${supplier.email || 'N/A'}</li>
      </ul>
      ${reason ? `<p><strong>Message from supplier:</strong> ${reason}</p>` : ''}
      <p>Please contact the supplier manually to verify and update their password in the <a href="${ADMIN_URL}/admin/suppliers">Admin Dashboard — Suppliers</a>.</p>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Password change request email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending password change request email:', error);
    return false;
  }
}

export async function sendChatNotificationEmail(senderName: string, message: string): Promise<boolean> {
  const mailOptions = {
    from: `"Supply Dashboard" <${process.env.EMAIL_USER}>`,
    to: ADMIN_EMAIL,
    subject: `💬 New Chat Message from ${senderName}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #3b82f6, #6366f1); padding: 20px; border-radius: 12px 12px 0 0; color: white;">
          <h2 style="margin: 0; font-size: 18px;">💬 New Support Message</h2>
        </div>
        <div style="background: #ffffff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; padding: 20px;">
          <p style="margin: 0 0 8px 0; font-size: 13px; color: #6b7280;">From: <strong style="color: #1f2937;">${senderName}</strong></p>
          <div style="background: #f3f4f6; border-radius: 8px; padding: 12px; margin: 12px 0;">
            <p style="margin: 0; font-size: 14px; color: #374151; line-height: 1.5;">${message}</p>
          </div>
          <a href="${ADMIN_URL}/admin/support"
             style="display: inline-block; margin-top: 12px; padding: 10px 20px; background: #3b82f6; color: white; text-decoration: none; border-radius: 8px; font-size: 13px; font-weight: 600;">
            Reply in Dashboard →
          </a>
        </div>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Chat notification email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending chat notification email:', error);
    return false;
  }
}

export async function sendProfileUpdateEmail(supplier: any, changes: string[]): Promise<boolean> {
  const mailOptions = {
    from: `"Supply Dashboard" <${process.env.EMAIL_USER}>`,
    to: ADMIN_EMAIL,
    subject: `📝 Profile Updated: ${supplier.name || supplier.businessName}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #8b5cf6, #6366f1); padding: 20px; border-radius: 12px 12px 0 0; color: white;">
          <h2 style="margin: 0; font-size: 18px;">📝 Supplier Profile Updated</h2>
        </div>
        <div style="background: #ffffff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; padding: 20px;">
          <p style="margin: 0 0 12px 0; font-size: 14px; color: #374151;"><strong>${supplier.name}</strong> (${supplier.businessName || 'N/A'}) updated their profile:</p>
          <ul style="margin: 0; padding: 0 0 0 20px;">
            ${changes.map(c => `<li style="font-size: 13px; color: #4b5563; margin-bottom: 4px;">${c}</li>`).join('')}
          </ul>
          <a href="${ADMIN_URL}/admin/suppliers"
             style="display: inline-block; margin-top: 16px; padding: 10px 20px; background: #8b5cf6; color: white; text-decoration: none; border-radius: 8px; font-size: 13px; font-weight: 600;">
            View in Dashboard →
          </a>
        </div>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Profile update email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending profile update email:', error);
    return false;
  }
}

export async function sendProductUpdateEmail(productName: string, supplierName: string, changes: string): Promise<boolean> {
  const mailOptions = {
    from: `"Supply Dashboard" <${process.env.EMAIL_USER}>`,
    to: ADMIN_EMAIL,
    subject: `Product Updated: ${productName} by ${supplierName}`,
    html: `
      <h2>Product Updated</h2>
      <p><strong>${supplierName}</strong> updated their product <strong>"${productName}"</strong>.</p>
      <h3>Changes:</h3>
      <p>${changes}</p>
      <p>Log in to the <a href="${ADMIN_URL}/admin/product-updates">Admin Dashboard — Product Updates</a> to review.</p>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Product update email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending product update email:', error);
    return false;
  }
}

// Send email to supplier
export async function sendSupplierNotificationEmail(
  supplierEmail: string,
  subject: string,
  bodyHtml: string,
  ctaLink?: string,
  ctaText?: string
): Promise<boolean> {
  if (!supplierEmail) return false;
  const mailOptions = {
    from: `"VCNITI Supply Dashboard" <${process.env.EMAIL_USER}>`,
    to: supplierEmail,
    subject,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #6366f1, #3b82f6); padding: 20px; border-radius: 12px 12px 0 0; color: white;">
          <h2 style="margin: 0; font-size: 18px;">${subject}</h2>
        </div>
        <div style="background: #ffffff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; padding: 20px;">
          ${bodyHtml}
          ${ctaLink ? `<a href="${SUPPLIER_URL}${ctaLink}" style="display: inline-block; margin-top: 12px; padding: 10px 20px; background: #3b82f6; color: white; text-decoration: none; border-radius: 8px; font-size: 13px; font-weight: 600;">${ctaText || 'View in Dashboard'} →</a>` : ''}
        </div>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Supplier notification email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending supplier email:', error);
    return false;
  }
}

// Send order status change email to admin
export async function sendOrderStatusEmail(
  supplierName: string,
  orderRef: string,
  newStatus: string,
  note?: string
): Promise<boolean> {
  const mailOptions = {
    from: `"Supply Dashboard" <${process.env.EMAIL_USER}>`,
    to: ADMIN_EMAIL,
    subject: `Order Update: ${supplierName} — ${newStatus}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 20px; border-radius: 12px 12px 0 0; color: white;">
          <h2 style="margin: 0; font-size: 18px;">Order Status Update</h2>
        </div>
        <div style="background: #ffffff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; padding: 20px;">
          <p style="margin: 0 0 8px 0; font-size: 14px; color: #374151;"><strong>${supplierName}</strong>'s order status changed to <strong>${newStatus}</strong>.</p>
          ${orderRef ? `<p style="margin: 0 0 8px 0; font-size: 13px; color: #6b7280;">Order Ref: ${orderRef}</p>` : ''}
          ${note ? `<p style="margin: 0 0 8px 0; font-size: 13px; color: #6b7280;">Note: ${note}</p>` : ''}
          <a href="${ADMIN_URL}/admin/order-history" style="display: inline-block; margin-top: 12px; padding: 10px 20px; background: #10b981; color: white; text-decoration: none; border-radius: 8px; font-size: 13px; font-weight: 600;">View Order History →</a>
        </div>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Order status email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending order status email:', error);
    return false;
  }
}

// Send email to admin when supplier submits a product
export async function sendProductSubmissionEmail(
  supplierName: string,
  productName: string,
  quantity: number,
  sellingPrice: number,
  source: string,
  variantCount?: number
): Promise<boolean> {
  const mailOptions = {
    from: `"Supply Dashboard" <${process.env.EMAIL_USER}>`,
    to: ADMIN_EMAIL,
    subject: `📦 New Product Submission: ${productName} by ${supplierName}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #8b5cf6, #6366f1); padding: 20px; border-radius: 12px 12px 0 0; color: white;">
          <h2 style="margin: 0; font-size: 18px;">📦 New Product Submission</h2>
        </div>
        <div style="background: #ffffff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; padding: 20px;">
          <p style="margin: 0 0 12px 0; font-size: 14px; color: #374151;"><strong>${supplierName}</strong> submitted a product for review.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 12px 0;">
            <tr><td style="padding: 8px 0; font-size: 13px; color: #6b7280; border-bottom: 1px solid #f3f4f6;">Product</td><td style="padding: 8px 0; font-size: 13px; color: #1f2937; font-weight: 600; text-align: right; border-bottom: 1px solid #f3f4f6;">${productName}</td></tr>
            <tr><td style="padding: 8px 0; font-size: 13px; color: #6b7280; border-bottom: 1px solid #f3f4f6;">Source</td><td style="padding: 8px 0; font-size: 13px; color: #1f2937; text-align: right; border-bottom: 1px solid #f3f4f6;">${source === 'catalog' ? 'From Catalog' : 'Custom Product'}</td></tr>
            <tr><td style="padding: 8px 0; font-size: 13px; color: #6b7280; border-bottom: 1px solid #f3f4f6;">Quantity</td><td style="padding: 8px 0; font-size: 13px; color: #1f2937; text-align: right; border-bottom: 1px solid #f3f4f6;">${quantity}</td></tr>
            <tr><td style="padding: 8px 0; font-size: 13px; color: #6b7280; border-bottom: 1px solid #f3f4f6;">Selling Price</td><td style="padding: 8px 0; font-size: 13px; color: #1f2937; font-weight: 600; text-align: right; border-bottom: 1px solid #f3f4f6;">₹${sellingPrice}</td></tr>
            ${variantCount ? `<tr><td style="padding: 8px 0; font-size: 13px; color: #6b7280;">Variants</td><td style="padding: 8px 0; font-size: 13px; color: #1f2937; text-align: right;">${variantCount}</td></tr>` : ''}
          </table>
          <a href="${ADMIN_URL}/admin/submissions" style="display: inline-block; margin-top: 12px; padding: 10px 20px; background: #8b5cf6; color: white; text-decoration: none; border-radius: 8px; font-size: 13px; font-weight: 600;">Review Submission →</a>
        </div>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Product submission email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending product submission email:', error);
    return false;
  }
}

// Send email to supplier when admin approves/rejects their product
export async function sendProductDecisionEmail(
  supplierEmail: string,
  supplierName: string,
  productName: string,
  decision: 'approved' | 'rejected',
  addedToShopify?: boolean
): Promise<boolean> {
  if (!supplierEmail) return false;

  const isApproved = decision === 'approved';
  const color = isApproved ? '#10b981' : '#ef4444';
  const icon = isApproved ? '✅' : '❌';
  const statusText = isApproved ? 'Approved' : 'Rejected';

  const mailOptions = {
    from: `"VCNITI Supply Dashboard" <${process.env.EMAIL_USER}>`,
    to: supplierEmail,
    subject: `${icon} Product ${statusText}: ${productName}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, ${color}, ${isApproved ? '#059669' : '#dc2626'}); padding: 20px; border-radius: 12px 12px 0 0; color: white;">
          <h2 style="margin: 0; font-size: 18px;">${icon} Product ${statusText}</h2>
        </div>
        <div style="background: #ffffff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; padding: 20px;">
          <p style="margin: 0 0 12px 0; font-size: 14px; color: #374151;">Hi <strong>${supplierName}</strong>,</p>
          <p style="margin: 0 0 12px 0; font-size: 14px; color: #374151;">Your product <strong>"${productName}"</strong> has been <strong style="color: ${color};">${statusText.toLowerCase()}</strong> by the admin.</p>
          ${isApproved && addedToShopify ? '<p style="margin: 0 0 12px 0; font-size: 13px; color: #6b7280;">The product has been added to Shopify as a draft.</p>' : ''}
          ${!isApproved ? '<p style="margin: 0 0 12px 0; font-size: 13px; color: #6b7280;">Please contact admin for more details or resubmit with changes.</p>' : ''}
          <a href="${SUPPLIER_URL}/supplier/products" style="display: inline-block; margin-top: 12px; padding: 10px 20px; background: ${color}; color: white; text-decoration: none; border-radius: 8px; font-size: 13px; font-weight: 600;">View Your Products →</a>
        </div>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Product decision email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending product decision email:', error);
    return false;
  }
}

// Send email to supplier when admin assigns an order
export async function sendOrderAssignedEmail(
  supplierEmail: string,
  supplierName: string,
  itemCount: number,
  orderRef: string,
  items: { productName: string; quantity: number }[]
): Promise<boolean> {
  if (!supplierEmail) return false;

  const itemRows = items.slice(0, 10).map(item =>
    `<tr><td style="padding: 6px 8px; font-size: 13px; color: #374151; border-bottom: 1px solid #f3f4f6;">${item.productName}</td><td style="padding: 6px 8px; font-size: 13px; color: #1f2937; text-align: right; border-bottom: 1px solid #f3f4f6;">${item.quantity}</td></tr>`
  ).join('');

  const mailOptions = {
    from: `"VCNITI Supply Dashboard" <${process.env.EMAIL_USER}>`,
    to: supplierEmail,
    subject: `🛒 New Order Assigned: ${orderRef || `${itemCount} item(s)`}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 20px; border-radius: 12px 12px 0 0; color: white;">
          <h2 style="margin: 0; font-size: 18px;">🛒 New Order Assigned</h2>
        </div>
        <div style="background: #ffffff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; padding: 20px;">
          <p style="margin: 0 0 12px 0; font-size: 14px; color: #374151;">Hi <strong>${supplierName}</strong>,</p>
          <p style="margin: 0 0 12px 0; font-size: 14px; color: #374151;">A new order has been assigned to you with <strong>${itemCount} item(s)</strong>. Please review and respond.</p>
          ${orderRef ? `<p style="margin: 0 0 12px 0; font-size: 13px; color: #6b7280;">Order Reference: <strong>${orderRef}</strong></p>` : ''}
          <table style="width: 100%; border-collapse: collapse; margin: 12px 0;">
            <tr style="background: #f9fafb;"><th style="padding: 8px; font-size: 12px; color: #6b7280; text-align: left;">Product</th><th style="padding: 8px; font-size: 12px; color: #6b7280; text-align: right;">Qty</th></tr>
            ${itemRows}
          </table>
          ${items.length > 10 ? `<p style="font-size: 12px; color: #9ca3af;">+${items.length - 10} more items</p>` : ''}
          <a href="${SUPPLIER_URL}/supplier/orders" style="display: inline-block; margin-top: 12px; padding: 10px 20px; background: #f59e0b; color: white; text-decoration: none; border-radius: 8px; font-size: 13px; font-weight: 600;">View & Respond →</a>
        </div>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Order assigned email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending order assigned email:', error);
    return false;
  }
}

