"use client";

/**
 * plugin/flash-sale/lib/registerResolver.ts
 *
 * Client-side init module that registers the flash-sale price resolver
 * into the product plugin's registry (from flashSaleOptional.ts).
 *
 * This file is imported once by flash-sale/index.ts during register().
 * The resolver uses the module-level campaign cache from useFlashSale.ts.
 */

import { registerFlashSaleResolver } from "@/plugin/product/box/flashSaleOptional";
import {
    findMatchingCampaign,
    applyFlashSale as computeFlashSale,
    type FlashSaleCampaignFull,
} from "./applyFlashSale";

// ── Module-level campaign cache (shared with useFlashSale) ────────────────────
// Initialized on first call, cached for the lifetime of the page.
let _campaigns:  FlashSaleCampaignFull[] | null = null;
let _fetchPromise: Promise<void> | null = null;

async function loadCampaigns(): Promise<void> {
    if (_campaigns !== null) return;
    if (_fetchPromise) return _fetchPromise;

    _fetchPromise = fetch("/api/flash-sale?active=true", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : { campaigns: [] }))
        .then((data) => {
            _campaigns = Array.isArray(data.campaigns) ? data.campaigns : [];
        })
        .catch(() => {
            _campaigns = [];
        });

    return _fetchPromise;
}

// ── Resolver ──────────────────────────────────────────────────────────────────

registerFlashSaleResolver((originalPrice, productId, categoryId) => {
    if (!_campaigns || _campaigns.length === 0) {
        // Not yet loaded or no campaigns — return original price
        return {
            applied: false,
            regularPrice: originalPrice,
            sellingPrice: originalPrice,
            discountPercent: 0,
            campaign: null,
        };
    }

    const matched = findMatchingCampaign(_campaigns, productId, categoryId ?? null);
    return computeFlashSale(originalPrice, matched);
});

// ── Auto-load campaigns on module evaluation ──────────────────────────────────
// Since this file is imported by flash-sale/index.ts during register() (which
// runs on client-side mount), campaigns will start loading immediately when
// the plugin is active.
if (typeof window !== "undefined") {
    loadCampaigns();
}
