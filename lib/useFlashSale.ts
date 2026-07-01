"use client";

/**
 * plugin/flash-sale/lib/useFlashSale.ts
 *
 * Client-side hook. Fetches active flash-sale campaigns once (module-level cache)
 * and exposes a `resolvePrice` helper that computes display prices on the fly.
 *
 * Safe to call from Product-1, Product-2, and any other product card component.
 * When the flash-sale plugin is not installed or no campaign is active the hook
 * returns the original prices untouched.
 */

import { useState, useEffect } from "react";
import {
    findMatchingCampaign,
    applyFlashSale,
    type FlashSaleCampaignFull,
    type FlashSaleResult,
} from "./applyFlashSale";

// ── Module-level cache — one fetch per page load across all product cards ─────
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

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UseFlashSaleReturn {
    /** True after campaigns have been fetched */
    ready: boolean;
    /**
     * Resolve display prices for a product.
     *
     * @param originalPrice  - The base price (sellingPrice or regularPrice)
     * @param productId      - MongoDB _id string
     * @param categoryId     - Category _id string (or null)
     */
    resolvePrice: (
        originalPrice: number,
        productId:     string,
        categoryId?:   string | null
    ) => FlashSaleResult;
}

export default function useFlashSale(): UseFlashSaleReturn {
    const [ready, setReady] = useState<boolean>(_campaigns !== null);

    useEffect(() => {
        if (_campaigns !== null) { setReady(true); return; }
        loadCampaigns().then(() => setReady(true));
    }, []);

    const resolvePrice = (
        originalPrice: number,
        productId:     string,
        categoryId?:   string | null
    ): FlashSaleResult => {
        if (!ready || !_campaigns || _campaigns.length === 0) {
            return {
                applied:        false,
                regularPrice:   originalPrice,
                sellingPrice:   originalPrice,
                discountPercent: 0,
                campaign:       null,
            };
        }
        const matched = findMatchingCampaign(_campaigns, productId, categoryId ?? null);
        return applyFlashSale(originalPrice, matched);
    };

    return { ready, resolvePrice };
}

/** Reset the module-level cache (useful in tests or after admin updates) */
export function resetFlashSaleCache(): void {
    _campaigns = null;
    _fetchPromise = null;
}
