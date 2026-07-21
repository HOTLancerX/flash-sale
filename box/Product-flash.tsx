"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@iconify/react";
import useFlashSale from "../lib/useFlashSale";
import { applyFlashSale } from "../lib/applyFlashSale";
import VariantPopup, { type VariantData } from "@/plugin/product/box/VariantPopup";

interface ProductBoxProps {
  data: {
    _id: string;
    title: string;
    slug: string;
    status: string;
    category?: string | null;
    createdAt?: string;
    info: Record<string, string>;
  };
  productUrl: string;
  currencySymbol?: string;
  flashSaleCampaign?: any;
}

function parseJson<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function fmtPrice(n: number): string {
  return Number(n).toLocaleString("en-US", {
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function addToCartDirect(item: Record<string, unknown>) {
  try {
    const raw = localStorage.getItem("shopping_cart");
    const cart: any[] = raw ? JSON.parse(raw) : [];
    const idx = cart.findIndex(
      (c: any) => c.productId === item.productId && c.variantId === item.variantId
    );
    const maxQty = (item.maxQuantity as number) ?? 9999;
    const addQty = Math.max(1, (item.quantity as number) || 1);
    if (idx >= 0) {
      cart[idx].quantity = Math.min((cart[idx].quantity ?? 0) + addQty, maxQty);
    } else {
      cart.push({ ...item, quantity: Math.min(addQty, maxQty) });
    }
    localStorage.setItem("shopping_cart", JSON.stringify(cart));
    window.dispatchEvent(new Event("cartUpdated"));
  } catch {
    /* localStorage unavailable */
  }
}

function StockPill({ stock }: { stock: number }) {
  if (stock <= 0) {
    return (
      <div className="w-full bg-gray-100 text-gray-400 rounded-full py-1 px-3 text-[10px] sm:text-xs font-bold flex items-center justify-center gap-1 border border-gray-200">
        <Icon icon="mdi:alert-circle-outline" className="w-3.5 h-3.5" />
        Sold Out
      </div>
    );
  }
  return (
    <div className="w-full bg-[#f3525a] text-white rounded-full py-1.5 px-3 text-[10px] sm:text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-transform group-hover:scale-[1.02]">
      <Icon icon="solar:flame-bold" className="w-3.5 h-3.5 text-yellow-300 animate-pulse shrink-0" />
      <span>{stock} Stock left</span>
    </div>
  );
}

export default function ProductFlashBox({
  data,
  productUrl,
  currencySymbol = "৳",
  flashSaleCampaign,
}: ProductBoxProps) {
  const { resolvePrice } = useFlashSale();

  const variate = parseJson<Record<string, any>>(data.info?._variate, {});
  const priceType = (variate.priceType ?? "single") as "single" | "variant";
  const variants = (variate.variants ?? []) as VariantData[];

  // ── Pricing calculation ──────────────────────────────────────────────────
  const sellingPrice = parseFloat(variate.sellingprice ?? "0") || 0;
  const regularPrice = parseFloat(variate.regularprice ?? "0") || 0;
  const singleStock = parseInt(variate.stock ?? "0", 10) || 0;
  const basePrice = sellingPrice > 0 ? sellingPrice : regularPrice;

  const flashResult = flashSaleCampaign
    ? applyFlashSale(basePrice, flashSaleCampaign)
    : resolvePrice(basePrice, String(data._id), data.category ?? null);

  const hasFlash = flashResult.applied;
  const productHasDisc = !hasFlash && sellingPrice > 0 && regularPrice > sellingPrice;
  const displayRegular = hasFlash ? flashResult.regularPrice : (productHasDisc ? regularPrice : basePrice);
  const displaySelling = hasFlash ? flashResult.sellingPrice : basePrice;
  const discountPercent = hasFlash
    ? flashResult.discountPercent
    : (productHasDisc ? Math.round(((regularPrice - sellingPrice) / regularPrice) * 100) : 0);
  const currentPrice = priceType === "single" ? displaySelling : 0;
  const showStrike = hasFlash || productHasDisc;

  // Variant calculations
  const variantPrices = variants.map((v) => parseFloat(v.price ?? "0") || 0).filter((p) => p > 0);
  const minVarPrice = variantPrices.length ? Math.min(...variantPrices) : 0;
  const maxVarPrice = variantPrices.length ? Math.max(...variantPrices) : 0;
  const variantStock = variants.reduce((s, v) => s + (parseInt(v.quantity ?? "0", 10) || 0), 0);

  const selectedAttributes: { label: string; values: string[]; displayStyle?: string }[] =
    variate.selectedAttributes ?? [];

  const colorAttr =
    selectedAttributes.find((a) => (a.displayStyle ?? "").includes("color")) ??
    selectedAttributes.find((a) => variants.some((v) => v.options[a.label] && v.color));

  type Swatch = { value: string; hex: string; image: string };
  const swatches: Swatch[] = [];
  if (colorAttr) {
    const seen = new Set<string>();
    for (const val of colorAttr.values) {
      if (seen.has(val)) continue;
      seen.add(val);
      const m = variants.find((v) => v.options[colorAttr.label] === val);
      swatches.push({ value: val, hex: m?.color ?? "", image: m?.image ?? "" });
    }
  }

  const [activeSwatch] = useState<string | null>(swatches[0]?.value ?? null);
  const [showPopup, setShowPopup] = useState(false);

  // Resolve display image
  let img = "";
  if (priceType === "variant" && activeSwatch && colorAttr) {
    img = variants.find((v) => v.options[colorAttr.label] === activeSwatch)?.image ?? "";
  }
  if (!img) {
    for (const v of variants) {
      if (v.image) {
        img = v.image;
        break;
      }
    }
  }
  if (!img) {
    img = parseJson<string[]>(data.info?.images, [])[0] ?? "";
  }

  const inStock = priceType === "single" ? singleStock > 0 : variantStock > 0;
  const totalStock = priceType === "single" ? singleStock : variantStock;

  const handleCartClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!inStock) return;
    if (priceType === "variant") {
      setShowPopup(true);
      return;
    }
    addToCartDirect({
      productId: String(data._id),
      productSlug: data.slug,
      productTitle: data.title,
      productImage: img,
      price: currentPrice,
      maxQuantity: singleStock,
      shippingInside: parseFloat(data.info?.shipping_inside ?? "") || undefined,
      shippingOutside: parseFloat(data.info?.shipping_outside ?? "") || undefined,
    });
  };

  const handleVariantCart = (variant: VariantData, qty: number) => {
    addToCartDirect({
      productId: String(data._id),
      productSlug: data.slug,
      productTitle: data.title,
      productImage: variant.image || img,
      variantId: variant.id,
      variantOptions: variant.options,
      sku: variant.sku,
      price: parseFloat(variant.price ?? "0") || 0,
      maxQuantity: parseInt(variant.quantity ?? "0", 10) || 9999,
      quantity: qty,
      shippingInside: parseFloat(data.info?.shipping_inside ?? "") || undefined,
      shippingOutside: parseFloat(data.info?.shipping_outside ?? "") || undefined,
    });
  };

  return (
    <>
      <div className="group relative bg-white hover:shadow-md transition-all duration-300 flex flex-col h-full overflow-hidden">
        {/* Save Badge Flag Overlay (matching sfs.png ribbon design) */}
        {discountPercent > 0 && (
          <div className="absolute top-0 left-0 z-10 bg-[#f3525a] text-white md:hidden flex flex-col items-center justify-center font-bold px-2.5 py-1 rounded-br-2xl shadow-sm leading-tight">
            <span className="text-[8px] sm:text-[9px] uppercase tracking-wider">SAVE</span>
            <span className="text-xs sm:text-sm font-extrabold">{discountPercent}%</span>
          </div>
        )}

        {/* Product Image */}
        <Link href={productUrl} className="block aspect-square overflow-hidden bg-gray-50 relative group" tabIndex={-1}>
          {img ? (
            <Image
              src={img}
              alt={data.title}
              width={350}
              height={350}
              className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
              unoptimized
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-200">
              <Icon icon="mdi:image-off" width={40} />
            </div>
          )}
        </Link>

        {/* Product Body Details */}
        <div className="flex flex-col flex-1 p-2.5 sm:p-3.5 gap-2">
          {/* Title */}
          <Link
            href={productUrl}
            className="text-xs sm:text-sm font-medium text-gray-800 hover:text-[#f3525a] transition-colors line-clamp-2 leading-snug"
          >
            {data.title}
          </Link>

          {/* Pricing Block */}
          <div className="flex flex-col gap-0.5 mt-auto">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              {priceType === "single" ? (
                currentPrice > 0 && (
                  <>
                    <span className="text-base sm:text-lg font-extrabold text-[#f3525a]">
                      {currencySymbol}{fmtPrice(currentPrice)}
                    </span>
                    {showStrike && (
                      <span className="text-xs text-gray-400 line-through">
                        {currencySymbol}{fmtPrice(displayRegular)}
                      </span>
                    )}
                    {discountPercent > 0 && (
                      <span className="text-[10px] sm:text-xs text-[#f3525a] font-semibold">
                        -{discountPercent}%
                      </span>
                    )}
                  </>
                )
              ) : (
                minVarPrice > 0 && (
                  <span className="text-base sm:text-lg font-extrabold text-[#f3525a]">
                    {minVarPrice === maxVarPrice
                      ? `${currencySymbol}${fmtPrice(minVarPrice)}`
                      : `${currencySymbol}${fmtPrice(minVarPrice)} – ${currencySymbol}${fmtPrice(maxVarPrice)}`}
                  </span>
                )
              )}
            </div>
          </div>

          {/* Stock Left Pill (matching sfs.png) */}
          <div className="pt-1" onClick={handleCartClick}>
            <StockPill stock={totalStock} />
          </div>
        </div>
      </div>

      {/* Variant Popup */}
      {showPopup && priceType === "variant" && (
        <VariantPopup
          productId={String(data._id)}
          productSlug={data.slug}
          productTitle={data.title}
          productImage={img}
          variants={variants}
          selectedAttributes={selectedAttributes}
          currencySymbol={currencySymbol}
          onClose={() => setShowPopup(false)}
          onAddToCart={handleVariantCart}
        />
      )}
    </>
  );
}
