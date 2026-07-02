/**
 * plugin/flash-sale/lib/applyFlashSale.ts
 *
 * Pure price computation utility for the flash-sale plugin.
 * No React, no side effects — safe to import in server and client code.
 *
 * ── Input price rule ────────────────────────────────────────────────────────
 * The caller must always pass the EFFECTIVE base price as `originalPrice`:
 *
 *   basePrice = sellingPrice > 0 ? sellingPrice : regularPrice
 *
 * If a product has a selling price set (product-level discount), the
 * flash-sale percentage is calculated on that selling price — NOT on the
 * regular price. The regular price is irrelevant to the campaign math.
 *
 * Example:
 *   Product: regularPrice=200, sellingPrice=150  →  basePrice = 150
 *   Campaign: real 10%
 *   Result:  regularPrice_display=150, sellingPrice_display=135
 *
 * ── FAKE sale (saleType === "fake") ─────────────────────────────────────────
 *   The customer pays exactly the original price (no real discount).
 *   We inflate the displayed "was" price to create a perceived saving.
 *
 *   displayed_was  = basePrice × (1 + pct / 100)   ← inflated
 *   displayed_now  = basePrice                      ← unchanged
 *
 *   e.g. basePrice=100, pct=10 → shows ~~110~~ → 100
 *
 * ── REAL sale (saleType === "real") ─────────────────────────────────────────
 *   Genuine markdown — the customer actually pays less.
 *
 *   displayed_was  = basePrice                      ← unchanged (crossed out)
 *   displayed_now  = basePrice × (1 − pct / 100)   ← discounted
 *
 *   e.g. basePrice=100, pct=10 → shows ~~100~~ → 90
 *   e.g. basePrice=150, pct=10 → shows ~~150~~ → 135
 */

export interface FlashSaleCampaignRef {
    _id: string;
    saleType:    "fake" | "real";
    percentage:  number;
    targetType:  "category" | "product";
    categoryIds: string[];
    productIds:  string[];
    isActive:    boolean;
    startDate:   string | null;
    endDate:     string | null;
}

/**
 * Full campaign shape returned by the API — extends the price-computation ref
 * with display fields used by the banner and the public flash-sale page.
 */
export interface FlashSaleCampaignFull extends FlashSaleCampaignRef {
    name:       string;
    image:      string;
    icon:       string;
    coverPhoto: string;
}

export interface FlashSaleResult {
    /** True when a flash-sale campaign was matched and applied */
    applied:         boolean;
    /** Price displayed crossed-out (the "was" price) */
    regularPrice:    number;
    /** Price the customer actually pays (the "now" price) */
    sellingPrice:    number;
    /** Discount percentage shown in the badge */
    discountPercent: number;
    /**
     * The full campaign that matched (includes name, image, icon, coverPhoto)
     * or null when no campaign applied.
     */
    campaign: FlashSaleCampaignFull | null;
}

// ─── Active check ─────────────────────────────────────────────────────────────

export function isCampaignActive(c: FlashSaleCampaignRef): boolean {
    if (!c.isActive) return false;
    const now = Date.now();
    if (c.startDate && new Date(c.startDate).getTime() > now) return false;
    if (c.endDate   && new Date(c.endDate).getTime()   < now) return false;
    return true;
}

// ─── Campaign matching ────────────────────────────────────────────────────────

/**
 * Return the first active campaign that targets this product.
 *
 * @param campaigns  - All active flash-sale campaigns (full objects from API)
 * @param productId  - MongoDB _id of the product (string)
 * @param categoryId - Category _id of the product (string or null)
 */
export function findMatchingCampaign(
    campaigns:  FlashSaleCampaignFull[],
    productId:  string,
    categoryId: string | null | undefined
): FlashSaleCampaignFull | null {
    for (const c of campaigns) {
        if (!isCampaignActive(c)) continue;
        if (c.targetType === "product") {
            if (c.productIds.includes(productId)) return c;
        } else {
            if (categoryId && c.categoryIds.includes(categoryId)) return c;
        }
    }
    return null;
}

// ─── Price computation ────────────────────────────────────────────────────────

/**
 * Compute display prices after applying a flash-sale campaign.
 *
 * IMPORTANT: pass `basePrice = sellingPrice > 0 ? sellingPrice : regularPrice`
 * — the campaign percentage is always applied to the effective selling price,
 * never to the product's original regular price.
 *
 * @param basePrice - Effective price to calculate on (sellingPrice || regularPrice)
 * @param campaign  - Matched campaign (FlashSaleCampaignFull from API), or null
 */
export function applyFlashSale(
    basePrice: number,
    campaign:  FlashSaleCampaignFull | null
): FlashSaleResult {
    if (!campaign || basePrice <= 0) {
        return {
            applied:         false,
            regularPrice:    basePrice,
            sellingPrice:    basePrice,
            discountPercent: 0,
            campaign:        null,
        };
    }

    const pct = campaign.percentage;

    if (campaign.saleType === "fake") {
        const inflated      = Math.round(basePrice * (1 + pct / 100) * 100) / 100;
        const discountShown = Math.round(((inflated - basePrice) / inflated) * 100);
        return {
            applied:         true,
            regularPrice:    inflated,
            sellingPrice:    basePrice,
            discountPercent: discountShown,
            campaign,
        };
    } else {
        const discounted = Math.round(basePrice * (1 - pct / 100) * 100) / 100;
        return {
            applied:         true,
            regularPrice:    basePrice,
            sellingPrice:    discounted,
            discountPercent: pct,
            campaign,
        };
    }
}
