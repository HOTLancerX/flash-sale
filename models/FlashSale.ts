/**
 * plugin/flash-sale/models/FlashSale.ts
 *
 * Mongoose model for Next.js server-side reads (page.tsx, serverHooks, etc.).
 * Mirrors the Express-server flash-sale/model.ts schema exactly.
 *
 * saleType:
 *   "fake"  — inflate price by percentage, show original as "sale" price.
 *             e.g. price=100, pct=10 → display: ~~110~~ → 100
 *   "real"  — genuine markdown.
 *             e.g. price=100, pct=10 → display: ~~100~~ → 90
 */

import mongoose, { Schema, type Document } from "mongoose";

export interface IFlashSaleCampaign extends Document {
    name:        string;
    image:       string;
    icon:        string;
    coverPhoto:  string;
    saleType:    "fake" | "real";
    percentage:  number;
    targetType:  "category" | "product";
    categoryIds: string[];
    productIds:  string[];
    isActive:    boolean;
    startDate:   Date | null;
    endDate:     Date | null;
    createdAt:   Date;
    updatedAt:   Date;
}

const FlashSaleCampaignSchema = new Schema<IFlashSaleCampaign>(
    {
        name:        { type: String, required: true },
        image:       { type: String, default: "" },
        icon:        { type: String, default: "" },
        coverPhoto:  { type: String, default: "" },
        saleType:    { type: String, enum: ["fake", "real"], default: "real" },
        percentage:  { type: Number, required: true, min: 0, max: 100 },
        targetType:  { type: String, enum: ["category", "product"], default: "product" },
        categoryIds: [{ type: String }],
        productIds:  [{ type: String }],
        isActive:    { type: Boolean, default: true },
        startDate:   { type: Date, default: null },
        endDate:     { type: Date, default: null },
    },
    { timestamps: true, collection: "flashsalecampaigns" }
);

export default (mongoose.models.FlashSaleCampaign as mongoose.Model<IFlashSaleCampaign>) ||
    mongoose.model<IFlashSaleCampaign>("FlashSaleCampaign", FlashSaleCampaignSchema);
