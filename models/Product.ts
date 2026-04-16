import mongoose, { Model } from 'mongoose';

const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    images: [{ type: String }],
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, required: true, min: 0 },
    unit: { type: String, default: 'pcs' },
    category: { type: String },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
    isAvailable: { type: Boolean, default: true },
    lastUpdated: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

ProductSchema.index({ supplier: 1 });

const Product: Model<any> = mongoose.models.Product || mongoose.model('Product', ProductSchema);
export default Product;
