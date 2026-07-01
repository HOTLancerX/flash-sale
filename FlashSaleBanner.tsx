"use client";

/**
 * plugin/flash-sale/FlashSaleBanner.tsx
 *
 * Floating announcement banner — shown globally when a flash-sale campaign is active.
 * Registered as a root.pages "root" entry so the root layout renders it on every page.
 *
 * The banner shows the campaign name, image/icon, and a link to /flash-sale.
 * It can be dismissed by the user (stored in sessionStorage so it re-shows on refresh).
 * If no campaign is active, or the flash-sale plugin is not installed, the
 * component renders nothing.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";
import type { FlashSaleCampaignFull } from "./lib/applyFlashSale";

const STORAGE_KEY = "flash_sale_banner_dismissed";

export default function FlashSaleBanner() {
    const [campaign,  setCampaign]  = useState<FlashSaleCampaignFull | null>(null);
    const [dismissed, setDismissed] = useState(true); // start hidden to avoid flash

    useEffect(() => {
        const wasDismissed = sessionStorage.getItem(STORAGE_KEY) === "1";
        if (wasDismissed) return;

        fetch("/api/flash-sale?active=true", { cache: "no-store" })
            .then(r => r.ok ? r.json() : { campaigns: [] })
            .then(data => {
                const list: FlashSaleCampaignFull[] = Array.isArray(data.campaigns)
                    ? data.campaigns : [];
                if (list.length > 0) {
                    setCampaign(list[0]);
                    setDismissed(false);
                }
            })
            .catch(() => {});
    }, []);

    const handleDismiss = () => {
        sessionStorage.setItem(STORAGE_KEY, "1");
        setDismissed(true);
    };

    if (dismissed || !campaign) return null;

    return (
        <div className="w-full bg-linear-to-r from-rose-600 to-pink-600 text-white text-sm py-2 px-4 flex items-center justify-between gap-3 z-50">
            <div className="flex items-center gap-3 flex-1 min-w-0">
                {/* Campaign image / icon */}
                {campaign.image ? (
                    <img src={campaign.image} alt="" className="w-6 h-6 rounded object-cover shrink-0" />
                ) : campaign.icon ? (
                    <Icon icon={campaign.icon} width={20} className="shrink-0" />
                ) : (
                    <Icon icon="solar:tag-price-bold" width={20} className="shrink-0" />
                )}

                <span className="font-semibold truncate">
                    🔥 Flash Sale — {campaign.name}
                </span>

                <Link href="/flash-sale"
                    className="shrink-0 underline underline-offset-2 hover:no-underline text-white/90 hover:text-white font-medium">
                    View deals →
                </Link>
            </div>

            <button type="button" onClick={handleDismiss} aria-label="Dismiss banner"
                className="shrink-0 p-1 rounded hover:bg-white/20 transition">
                <Icon icon="solar:close-bold" width={16} />
            </button>
        </div>
    );
}
