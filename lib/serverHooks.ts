/**
 * plugin/flash-sale/lib/serverHooks.ts — Server-only.
 *
 * Auto-discovered by hook/serverDataHooks.ts via require.context.
 *
 * Registers:
 *   1. "flash-sale" static page data hook
 *   2. Product page enricher — adds flashSaleCampaign to pageData
 *   3. Category page enricher — adds flashSaleCampaign to pageData
 *
 * No manual wiring anywhere. Just this file existing is enough.
 *
 * NEVER import from plugin/flash-sale/index.ts or any client component.
 */

import {
    registerServerDataHook,
    registerProductEnricher,
    registerCategoryEnricher,
} from "@/hook/serverDataHooks";
import connectDB from "@/lib/mongodb";
import mongoose from "mongoose";
import FlashSaleCampaign from "@/plugin/flash-sale/models/FlashSale";
import Post     from "@/models/post";
import PostInfo from "@/models/post_info";
import Cat      from "@/models/cat";
import type { FlashSaleCampaignFull } from "./applyFlashSale";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FlashSaleProduct {
    _id:      string;
    title:    string;
    slug:     string;
    category: string | null;
    info:     Record<string, string>;
}

export interface FlashSaleCategoryGroup {
    _id:      string;
    title:    string;
    slug:     string;
    products: FlashSaleProduct[];
}

export interface FlashSalePageData {
    campaign:       FlashSaleCampaignFull | null;
    categoryGroups: FlashSaleCategoryGroup[];
    products:       FlashSaleProduct[];
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function isNowActive(c: any): boolean {
    if (!c.isActive) return false;
    const now = new Date();
    if (c.startDate && new Date(c.startDate) > now) return false;
    if (c.endDate   && new Date(c.endDate)   < now) return false;
    return true;
}

function toOid(id: string): mongoose.Types.ObjectId | null {
    try { return new mongoose.Types.ObjectId(id); } catch { return null; }
}

/** Fetch all active campaigns once and filter by isNowActive. */
async function getActiveCampaigns(): Promise<FlashSaleCampaignFull[]> {
    const all = await FlashSaleCampaign.find({ isActive: true }).lean() as any[];
    return all.filter(isNowActive).map((raw: any): FlashSaleCampaignFull => ({
        _id:         String(raw._id),
        name:        String(raw.name        ?? ""),
        image:       String(raw.image       ?? ""),
        icon:        String(raw.icon        ?? ""),
        coverPhoto:  String(raw.coverPhoto  ?? ""),
        saleType:    raw.saleType   as "fake" | "real",
        percentage:  Number(raw.percentage),
        targetType:  raw.targetType as "category" | "product",
        categoryIds: raw.categoryIds ?? [],
        productIds:  raw.productIds  ?? [],
        isActive:    true,
        startDate:   raw.startDate ? new Date(raw.startDate).toISOString() : null,
        endDate:     raw.endDate   ? new Date(raw.endDate).toISOString()   : null,
    }));
}

/** Find the first campaign matching a product or category. */
function matchCampaign(
    campaigns:  FlashSaleCampaignFull[],
    productId:  string,
    categoryId: string | null
): FlashSaleCampaignFull | null {
    for (const c of campaigns) {
        if (c.targetType === "product"  && c.productIds.includes(productId))    return c;
        if (c.targetType === "category" && categoryId && c.categoryIds.includes(categoryId)) return c;
    }
    return null;
}

async function fetchProductsByIds(ids: string[]): Promise<FlashSaleProduct[]> {
    if (!ids.length) return [];
    const oids = ids.map(toOid).filter(Boolean) as mongoose.Types.ObjectId[];
    if (!oids.length) return [];
    const posts = await Post.find({ _id: { $in: oids }, type: "product", status: "published" }).lean() as any[];
    if (!posts.length) return [];
    const infoDocs = await PostInfo.find({ postId: { $in: posts.map((p: any) => p._id) } }).lean() as any[];
    const infoByPost: Record<string, Record<string, string>> = {};
    for (const r of infoDocs as any[]) {
        const key = String(r.postId);
        if (!infoByPost[key]) infoByPost[key] = {};
        infoByPost[key][r.name] = r.value;
    }
    return posts.map((p: any) => ({
        _id: String(p._id), title: String(p.title ?? ""), slug: String(p.slug ?? ""),
        category: p.category ? String(p.category) : null, info: infoByPost[String(p._id)] ?? {},
    }));
}

async function fetchProductsByCategories(catIds: string[]): Promise<FlashSaleProduct[]> {
    if (!catIds.length) return [];
    const oids = catIds.map(toOid).filter(Boolean) as mongoose.Types.ObjectId[];
    if (!oids.length) return [];
    const posts = await Post.find({ category: { $in: oids }, type: "product", status: "published" }).lean() as any[];
    if (!posts.length) return [];
    const infoDocs = await PostInfo.find({ postId: { $in: posts.map((p: any) => p._id) } }).lean() as any[];
    const infoByPost: Record<string, Record<string, string>> = {};
    for (const r of infoDocs as any[]) {
        const key = String(r.postId);
        if (!infoByPost[key]) infoByPost[key] = {};
        infoByPost[key][r.name] = r.value;
    }
    return posts.map((p: any) => ({
        _id: String(p._id), title: String(p.title ?? ""), slug: String(p.slug ?? ""),
        category: p.category ? String(p.category) : null, info: infoByPost[String(p._id)] ?? {},
    }));
}

// ─── 1. Static /flash-sale page ───────────────────────────────────────────────

registerServerDataHook("flash-sale", async (): Promise<FlashSalePageData> => {
    await connectDB();
    const campaigns = await getActiveCampaigns();
    if (!campaigns.length) return { campaign: null, categoryGroups: [], products: [] };

    const campaign = campaigns[0];

    if (campaign.targetType === "category") {
        const catOids = campaign.categoryIds.map(toOid).filter(Boolean) as mongoose.Types.ObjectId[];
        const catDocs = catOids.length
            ? (await Cat.find({ _id: { $in: catOids } }).lean() as any[])
            : [];
        const allProducts = await fetchProductsByCategories(campaign.categoryIds);
        const byCategory: Record<string, FlashSaleProduct[]> = {};
        for (const p of allProducts) {
            const key = p.category ?? "__none__";
            if (!byCategory[key]) byCategory[key] = [];
            byCategory[key].push(p);
        }
        const categoryGroups: FlashSaleCategoryGroup[] = catDocs
            .map((c: any) => ({ _id: String(c._id), title: String(c.title ?? ""), slug: String(c.slug ?? ""), products: byCategory[String(c._id)] ?? [] }))
            .filter(g => g.products.length > 0);
        return { campaign, categoryGroups, products: [] };
    } else {
        const products = await fetchProductsByIds(campaign.productIds);
        return { campaign, categoryGroups: [], products };
    }
});

// ─── 2. Product page enricher ─────────────────────────────────────────────────

registerProductEnricher(async (_pageData, postData) => {
    await connectDB();
    const productId  = String(postData?._id ?? "");
    const categoryId = postData?.category ? String(postData.category) : null;

    const campaigns = await getActiveCampaigns();
    const campaign  = matchCampaign(campaigns, productId, categoryId);

    return { flashSaleCampaign: campaign };
});

// ─── 3. Category page enricher ────────────────────────────────────────────────

registerCategoryEnricher(async (_pageData, catData) => {
    await connectDB();
    const catId = String(catData?._id ?? "");

    const campaigns = await getActiveCampaigns();
    // Match by category: find a campaign that targets this category
    const campaign = campaigns.find(c =>
        c.targetType === "category" && c.categoryIds.includes(catId)
    ) ?? null;

    return { flashSaleCampaign: campaign };
});
