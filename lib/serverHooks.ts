/**
 * plugin/flash-sale/lib/serverHooks.ts — Server-only.
 *
 * Auto-discovered by hook/serverDataHooks.ts via require.context.
 * Registers the data provider for the "flash-sale" static page.
 *
 * NEVER import this file from plugin/index.ts or any client component.
 * All Mongoose model imports stay here, isolated from the client bundle.
 *
 * The slug page calls runServerDataHook("flash-sale", ...) which triggers
 * this function. The returned object is passed as `pageData` to FlashSalePage.
 */

import { registerServerDataHook } from "@/hook/serverDataHooks";
import connectDB from "@/lib/mongodb";
import mongoose from "mongoose";

// Lazy model imports — never imported from client-side code
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
    campaign:        FlashSaleCampaignFull | null;
    /** Populated for category-wise campaigns */
    categoryGroups:  FlashSaleCategoryGroup[];
    /** Populated for product-wise campaigns */
    products:        FlashSaleProduct[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isNowActive(c: any): boolean {
    if (!c.isActive) return false;
    const now = new Date();
    if (c.startDate && new Date(c.startDate) > now) return false;
    if (c.endDate   && new Date(c.endDate)   < now) return false;
    return true;
}

async function fetchProductsByIds(ids: string[]): Promise<FlashSaleProduct[]> {
    if (!ids.length) return [];
    const objectIds = ids.flatMap(id => {
        try { return [new mongoose.Types.ObjectId(id)]; } catch { return []; }
    });
    if (!objectIds.length) return [];

    const posts = await Post.find({
        _id: { $in: objectIds }, type: "product", status: "published",
    }).lean() as any[];

    if (!posts.length) return [];

    const infoDocs = await PostInfo.find({ postId: { $in: posts.map((p: any) => p._id) } }).lean() as any[];
    const infoByPost: Record<string, Record<string, string>> = {};
    for (const r of infoDocs as any[]) {
        const key = String(r.postId);
        if (!infoByPost[key]) infoByPost[key] = {};
        infoByPost[key][r.name] = r.value;
    }

    return posts.map((p: any) => ({
        _id:      String(p._id),
        title:    String(p.title ?? ""),
        slug:     String(p.slug  ?? ""),
        category: p.category ? String(p.category) : null,
        info:     infoByPost[String(p._id)] ?? {},
    }));
}

async function fetchProductsByCategories(catIds: string[]): Promise<FlashSaleProduct[]> {
    if (!catIds.length) return [];
    const objectIds = catIds.flatMap(id => {
        try { return [new mongoose.Types.ObjectId(id)]; } catch { return []; }
    });
    if (!objectIds.length) return [];

    const posts = await Post.find({
        category: { $in: objectIds }, type: "product", status: "published",
    }).lean() as any[];

    if (!posts.length) return [];

    const infoDocs = await PostInfo.find({ postId: { $in: posts.map((p: any) => p._id) } }).lean() as any[];
    const infoByPost: Record<string, Record<string, string>> = {};
    for (const r of infoDocs as any[]) {
        const key = String(r.postId);
        if (!infoByPost[key]) infoByPost[key] = {};
        infoByPost[key][r.name] = r.value;
    }

    return posts.map((p: any) => ({
        _id:      String(p._id),
        title:    String(p.title ?? ""),
        slug:     String(p.slug  ?? ""),
        category: p.category ? String(p.category) : null,
        info:     infoByPost[String(p._id)] ?? {},
    }));
}

// ─── Data hook registration ───────────────────────────────────────────────────
// The slug page calls runServerDataHook("flash-sale", id, slug) for the static
// page (slug === "flash-sale"). We don't actually need id/slug here.

registerServerDataHook("flash-sale", async (): Promise<FlashSalePageData> => {
    await connectDB();

    const allCampaigns = await FlashSaleCampaign.find({ isActive: true }).lean() as any[];
    const active = allCampaigns.filter(isNowActive);

    if (!active.length) {
        return { campaign: null, categoryGroups: [], products: [] };
    }

    const raw = active[0];
    const campaign: FlashSaleCampaignFull = {
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
    };

    if (campaign.targetType === "category") {
        const catIds   = campaign.categoryIds;
        const catDocs  = catIds.length
            ? (await Cat.find({ _id: { $in: catIds.flatMap(id => { try { return [new mongoose.Types.ObjectId(id)]; } catch { return []; } }) } }).lean() as any[])
            : [];

        const allProducts = await fetchProductsByCategories(catIds);

        // Group by category
        const byCategory: Record<string, FlashSaleProduct[]> = {};
        for (const p of allProducts) {
            const key = p.category ?? "__none__";
            if (!byCategory[key]) byCategory[key] = [];
            byCategory[key].push(p);
        }

        const categoryGroups: FlashSaleCategoryGroup[] = catDocs.map((c: any) => ({
            _id:      String(c._id),
            title:    String(c.title ?? ""),
            slug:     String(c.slug  ?? ""),
            products: byCategory[String(c._id)] ?? [],
        })).filter(g => g.products.length > 0);

        return { campaign, categoryGroups, products: [] };
    } else {
        const products = await fetchProductsByIds(campaign.productIds);
        return { campaign, categoryGroups: [], products };
    }
});
