/**
 * plugin/flash-sale/api/flash-sale/route.ts
 * Auto-discovered by hook/pluginApiRoutes.ts → available at /api/flash-sale
 *
 * GET  /api/flash-sale              → all campaigns (admin)
 * GET  /api/flash-sale?active=true  → currently active campaigns (public)
 * GET  /api/flash-sale?id=<id>      → single campaign
 * POST /api/flash-sale              → create campaign
 * PUT  /api/flash-sale              → update campaign
 * DELETE /api/flash-sale?id=<id>    → delete campaign
 */

import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import FlashSaleCampaign from "@/plugin/flash-sale/models/FlashSale";

export const dynamic = "force-dynamic";

// ─── Helper: check if a campaign is active right now ──────────────────────────
function isNowActive(campaign: any): boolean {
    if (!campaign.isActive) return false;
    const now = new Date();
    if (campaign.startDate && new Date(campaign.startDate) > now) return false;
    if (campaign.endDate   && new Date(campaign.endDate)   < now) return false;
    return true;
}

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
    try {
        await connectDB();
        const { searchParams } = req.nextUrl;
        const id     = searchParams.get("id");
        const active = searchParams.get("active");

        if (id) {
            const doc = await FlashSaleCampaign.findById(id).lean();
            if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
            return NextResponse.json({ campaign: doc });
        }

        const all = await FlashSaleCampaign.find().sort({ createdAt: -1 }).lean();

        if (active === "true") {
            return NextResponse.json({ campaigns: all.filter(isNowActive) });
        }

        return NextResponse.json({ campaigns: all });
    } catch (err) {
        console.error("[flash-sale] GET error:", err);
        return NextResponse.json({ campaigns: [] }, { status: 500 });
    }
}

// ─── POST ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
    try {
        await connectDB();
        const body = await req.json() as Record<string, any>;

        if (!body.name || typeof body.name !== "string") {
            return NextResponse.json({ error: "name is required" }, { status: 400 });
        }
        const pct = Number(body.percentage);
        if (isNaN(pct) || pct < 0 || pct > 100) {
            return NextResponse.json({ error: "percentage must be 0–100" }, { status: 400 });
        }

        const doc = await FlashSaleCampaign.create({
            name:        body.name,
            image:       body.image       ?? "",
            icon:        body.icon        ?? "",
            coverPhoto:  body.coverPhoto  ?? "",
            saleType:    body.saleType    ?? "real",
            percentage:  pct,
            targetType:  body.targetType  ?? "product",
            categoryIds: Array.isArray(body.categoryIds) ? body.categoryIds : [],
            productIds:  Array.isArray(body.productIds)  ? body.productIds  : [],
            isActive:    body.isActive    !== false,
            startDate:   body.startDate   ? new Date(body.startDate) : null,
            endDate:     body.endDate     ? new Date(body.endDate)   : null,
        });

        return NextResponse.json({ campaign: doc }, { status: 201 });
    } catch (err) {
        console.error("[flash-sale] POST error:", err);
        return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 });
    }
}

// ─── PUT ──────────────────────────────────────────────────────────────────────
export async function PUT(req: NextRequest) {
    try {
        await connectDB();
        const body = await req.json() as Record<string, any>;
        const { _id, ...update } = body;

        if (!_id) return NextResponse.json({ error: "_id is required" }, { status: 400 });

        if (update.startDate) update.startDate = new Date(update.startDate);
        if (update.endDate)   update.endDate   = new Date(update.endDate);
        if (update.percentage !== undefined) update.percentage = Number(update.percentage);

        const doc = await FlashSaleCampaign.findByIdAndUpdate(_id, update, { new: true }).lean();
        if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

        return NextResponse.json({ campaign: doc });
    } catch (err) {
        console.error("[flash-sale] PUT error:", err);
        return NextResponse.json({ error: "Failed to update campaign" }, { status: 500 });
    }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
    try {
        await connectDB();
        const id = req.nextUrl.searchParams.get("id");
        if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

        await FlashSaleCampaign.findByIdAndDelete(id);
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("[flash-sale] DELETE error:", err);
        return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
    }
}
