/**
 * plugin/flash-sale/index.ts
 *
 * Flash Sale plugin for the CMS.
 *
 * Features:
 *  — Admin campaign manager  → /admin/flash-sale
 *  — Floating banner on all pages (dismissed per session)
 *  — Public /flash-sale page:
 *      • Category-wise: products grouped by category
 *      • Product-wise:  flat product grid
 *  — Automatic price adjustment in product boxes (Product-1, Product-2)
 *    via the useFlashSale hook — zero config, fully backwards-compatible
 *
 * When the plugin is not active / not installed:
 *  — No hooks are registered → no admin page, no banner, no price changes
 *  — Product boxes fall back to their built-in price logic untouched
 */

import { addHook, type PluginMeta } from "@/hook";
import FlashSaleManager  from "./settings/FlashSaleManager";
import FlashSaleBanner   from "./FlashSaleBanner";
import FlashSalePage     from "./FlashSalePage";

// ── Register the flash-sale price resolver ────────────────────────────────────
// This is a side-effect import — it calls registerFlashSaleResolver() when the
// module loads on the client, so product boxes can resolve prices dynamically.
import "./lib/registerResolver";

// ─── Plugin metadata ──────────────────────────────────────────────────────────

export const PLUGINS: PluginMeta = {
    nx:          "com.system.flash-sale",
    name:        "flash-sale",
    version:     "1.0.0",
    description: "Time-limited flash sale campaigns with real or fake pricing, category-wise and product-wise targeting.",
    author:      "System",
    path:        "https://github.com/HOTLancerX/flash-sale.git",
    icon:        "solar:tag-price-bold",
    color:       "from-rose-500 to-pink-600",
};

// ─── Hook registration ────────────────────────────────────────────────────────

export function register() {

    // ── Admin sidebar nav item ────────────────────────────────────────────────
    addHook("admin.nav", [
        {
            key:      "flash-sale",
            label:    "Flash Sale",
            icon:     "solar:tag-price-bold",
            slug:     "flash-sale",
            parent:   "",
            position: 21,
        },
    ], PLUGINS.nx);

    // ── Admin page: campaign manager ──────────────────────────────────────────
    // URL: /admin/flash-sale
    addHook("admin.pages", [
        {
            key:      "flash-sale",
            label:    "Flash Sale Manager",
            type:     "flash-sale-settings",
            style:    "left",
            position: 36,
            path:     FlashSaleManager,
        },
    ], PLUGINS.nx);

    // ── Floating announcement banner (site-wide, auto-dismissed) ─────────────
    addHook("root.pages", [
        {
            key:      "flash-sale-banner",
            label:    "Flash Sale Banner",
            slug:     "root",
            type:     "",
            style:    "left",
            position: 5,        // renders before free-offers banner (position 10)
            component: FlashSaleBanner,
        },
    ], PLUGINS.nx);

    // ── Public /flash-sale page ───────────────────────────────────────────────
    addHook("root.pages", [
        {
            key:      "flash-sale",
            label:    "Flash Sale Page",
            type:     "single",
            slug:     "single",
            style:    "left",
            position: 10,
            active:   true,
            component: FlashSalePage,
        },
    ], PLUGINS.nx);
}
