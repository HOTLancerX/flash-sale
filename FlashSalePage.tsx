/**
 * plugin/flash-sale/FlashSalePage.tsx
 *
 * Server component — registered as root.pages "single" at key "flash-sale".
 * Rendered by app/(root)/[...slug]/page.tsx when the URL is /flash-sale.
 *
 * NO Mongoose imports — all DB work is done in lib/serverHooks.ts which is
 * auto-discovered server-side only. Data arrives via the `pageData` prop,
 * exactly the same pattern as ProductCategoryLayout1.
 *
 * If the plugin is not active or no campaign is active the page shows a
 * "No active sale" message.
 */

import Link from "next/link";
import Image from "next/image";
import { Icon } from "@iconify/react";
import { getAllRootPages } from "@/hook";
import {
    applyFlashSale,
    findMatchingCampaign,
    type FlashSaleCampaignRef,
    type FlashSaleCampaignFull,
} from "./lib/applyFlashSale";
import type { FlashSalePageData, FlashSaleProduct } from "./lib/serverHooks";

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
    settings?:     Record<string, any>;
    permalinkMap?: Record<string, string>;
    pageData?:     FlashSalePageData;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildUrl(prefix: string, slug: string): string {
    const p = prefix.trim().replace(/^\/+|\/+$/g, "");
    return p ? `/${p}/${slug}` : `/${slug}`;
}

function parseJson<T>(raw: string | undefined, fallback: T): T {
    if (!raw) return fallback;
    try { return JSON.parse(raw) as T; } catch { return fallback; }
}

function fmtPrice(n: number, symbol: string): string {
    return `${symbol} ${Number(n).toLocaleString("en-US", {
        minimumFractionDigits: n % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
    })}`.trim();
}

/** Resolve the active product-box component from the permanent hook registry */
function resolveBoxComponent(): React.ComponentType<any> | null {
    const boxes = getAllRootPages().filter(
        (p) => p.type === "product-box" && p.slug === "dynamic"
    );
    if (!boxes.length) return null;
    return (boxes.find((b) => b.active === true) ?? boxes[0])?.component ?? null;
}

// ─── Flash Sale Product Card (server-rendered fallback) ───────────────────────

interface CardProps {
    product:        FlashSaleProduct;
    productUrl:     string;
    currencySymbol: string;
    campaign:       FlashSaleCampaignRef;
}

function FlashSaleCard({ product, productUrl, currencySymbol, campaign }: CardProps) {
    const variate      = parseJson<Record<string, any>>(product.info?._variate, {});
    const priceType    = (variate.priceType ?? "single") as string;
    const variants     = (variate.variants ?? []) as any[];
    const sellingPrice = parseFloat(variate.sellingprice ?? "0") || 0;
    const regularPrice = parseFloat(variate.regularprice ?? "0") || 0;
    const stock        = parseInt(variate.stock ?? "0", 10) || 0;
    const basePrice    = priceType === "single" ? (sellingPrice || regularPrice) : 0;
    const inStock      = priceType === "single"
        ? stock > 0
        : variants.some((v: any) => parseInt(v.quantity || "0") > 0);

    const result = applyFlashSale(basePrice, campaign);

    let img = "";
    for (const v of variants) { if (v.image) { img = v.image; break; } }
    if (!img) {
        const imgs = parseJson<string[]>(product.info?.images, []);
        img = imgs[0] ?? "";
    }

    return (
        <Link href={productUrl}
            className="group relative bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">

            {result.applied && (
                <span className="absolute top-3 left-3 z-10 bg-rose-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    -{result.discountPercent}%
                </span>
            )}
            <span className="absolute top-3 right-3 z-10">
                <Icon icon="solar:tag-price-bold" width={18} className="text-rose-400 opacity-70" />
            </span>

            <div className="aspect-square overflow-hidden bg-gray-50">
                {img ? (
                    <Image src={img} alt={product.title} width={400} height={400}
                        className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-200">
                        <Icon icon="mdi:image-off" width="48" height="48" />
                    </div>
                )}
            </div>

            <div className="flex flex-col flex-1 p-3 gap-2">
                <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug">
                    {product.title}
                </p>

                {priceType === "single" && basePrice > 0 ? (
                    <div className="flex items-center gap-2 flex-wrap mt-auto">
                        {result.applied && (
                            <span className="text-xs text-gray-400 line-through">
                                {fmtPrice(result.regularPrice, currencySymbol)}
                            </span>
                        )}
                        <span className="text-base font-bold text-rose-600">
                            {fmtPrice(result.sellingPrice, currencySymbol)}
                        </span>
                    </div>
                ) : priceType === "variant" ? (
                    <p className="text-xs text-gray-500 italic mt-auto">
                        {variants.length} variant{variants.length !== 1 ? "s" : ""} available
                    </p>
                ) : null}

                {inStock ? (
                    <span className="text-xs text-green-600 flex items-center gap-1">
                        <Icon icon="mdi:check-circle" width={13} /> In stock
                    </span>
                ) : (
                    <span className="text-xs text-red-400">Out of stock</span>
                )}
            </div>
        </Link>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FlashSalePage({ settings = {}, permalinkMap = {}, pageData }: Props) {
    const currencySymbol = (settings.product_currency_symbol as string) || "$";
    const productPrefix  = (permalinkMap["product"]          ?? "product").trim().replace(/^\/+|\/+$/g, "") || "product";
    const catPrefix      = (permalinkMap["product-category"] ?? "product/category").trim().replace(/^\/+|\/+$/g, "");

    const campaign       = pageData?.campaign       ?? null;
    const categoryGroups = pageData?.categoryGroups ?? [];
    const products       = pageData?.products       ?? [];

    const BoxComponent = resolveBoxComponent();

    // ── No active campaign ────────────────────────────────────────────────────
    if (!campaign) {
        return (
            <main className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center py-20 text-gray-400">
                    <Icon icon="solar:tag-price-bold" width={56} className="mx-auto mb-4 opacity-30" />
                    <h1 className="text-2xl font-bold text-gray-600 mb-2">No Active Flash Sales</h1>
                    <p className="text-sm">Check back soon for amazing deals.</p>
                    <Link href="/"
                        className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-rose-600 text-white rounded-lg text-sm font-semibold hover:bg-rose-500 transition">
                        <Icon icon="solar:home-2-bold" width={16} />
                        Back to Home
                    </Link>
                </div>
            </main>
        );
    }

    // ── Product card renderer ─────────────────────────────────────────────────
    const renderCard = (product: FlashSaleProduct) => {
        const url = buildUrl(productPrefix, product.slug);
        if (BoxComponent) {
            return (
                <BoxComponent
                    key={product._id}
                    data={{ ...product, status: "published" }}
                    productUrl={url}
                    currencySymbol={currencySymbol}
                    flashSaleCampaign={campaign as FlashSaleCampaignRef}
                />
            );
        }
        return (
            <FlashSaleCard
                key={product._id}
                product={product}
                productUrl={url}
                currencySymbol={currencySymbol}
                campaign={campaign as FlashSaleCampaignRef}
            />
        );
    };

    // ── Page content ──────────────────────────────────────────────────────────
    let pageContent: React.ReactNode;

    if (campaign.targetType === "category") {
        pageContent = categoryGroups.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
                <p className="text-lg font-medium">No products in this sale yet.</p>
            </div>
        ) : (
            <div className="space-y-12">
                {categoryGroups.map(group => (
                    <section key={group._id} className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                <Icon icon="solar:folder-with-files-bold" width={22} className="text-rose-500" />
                                {group.title}
                            </h2>
                            <Link href={buildUrl(catPrefix, group.slug)}
                                className="text-sm text-rose-600 hover:underline font-medium">
                                View all →
                            </Link>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                            {group.products.map(renderCard)}
                        </div>
                    </section>
                ))}
            </div>
        );
    } else {
        pageContent = products.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
                <p className="text-lg font-medium">No products in this sale yet.</p>
            </div>
        ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {products.map(renderCard)}
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-gray-50">
            {/* Hero banner */}
            <header
                className="relative bg-linear-to-r from-rose-600 to-pink-600 py-14 px-6 overflow-hidden"
                style={campaign.coverPhoto ? {
                    backgroundImage:    `url(${campaign.coverPhoto})`,
                    backgroundSize:     "cover",
                    backgroundPosition: "center",
                } : undefined}
            >
                {campaign.coverPhoto && <div className="absolute inset-0 bg-black/50" />}
                <div className="relative container text-center">
                    <div className="flex justify-center mb-4">
                        {campaign.image ? (
                            <img src={campaign.image} alt={campaign.name}
                                className="w-20 h-20 rounded-2xl object-cover shadow-xl ring-4 ring-white/30" />
                        ) : campaign.icon ? (
                            <div className="w-20 h-20 rounded-2xl bg-white/20 flex items-center justify-center shadow-xl">
                                <Icon icon={campaign.icon} width={44} className="text-white" />
                            </div>
                        ) : (
                            <div className="w-20 h-20 rounded-2xl bg-white/20 flex items-center justify-center shadow-xl">
                                <Icon icon="solar:tag-price-bold" width={44} className="text-white" />
                            </div>
                        )}
                    </div>

                    <div className="inline-flex items-center gap-2 bg-white/20 text-white text-sm font-semibold px-4 py-1.5 rounded-full mb-3">
                        <Icon icon="solar:fire-bold" width={16} />
                        Flash Sale
                    </div>

                    <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-3">
                        {campaign.name}
                    </h1>

                    <div className="flex items-center justify-center gap-3 flex-wrap text-white/80 text-sm">
                        <span className="bg-white/20 px-3 py-1 rounded-full font-bold text-white">
                            {campaign.percentage}% OFF
                        </span>
                        <span className="bg-white/20 px-3 py-1 rounded-full capitalize">
                            {campaign.saleType === "fake" ? "Promotional pricing" : "Genuine discount"}
                        </span>
                        {campaign.endDate && (
                            <span className="bg-white/20 px-3 py-1 rounded-full">
                                Ends {new Date(campaign.endDate).toLocaleDateString()}
                            </span>
                        )}
                    </div>
                </div>
            </header>

            <div className="container py-10">
                {pageContent}
            </div>
        </main>
    );
}
