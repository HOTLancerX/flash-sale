"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";
import useEmblaCarousel from "embla-carousel-react";
import ProductFlashBox from "../box/Product-flash";
import {
  Text,
  Select,
  ColorPickerPopup,
  NumberControl,
} from "@/components/builder/controls";
import { xFetch } from "@/lib/express";
import { getAllRootPages } from "@/hook";

interface ProductData {
  _id: string;
  title: string;
  slug: string;
  status: string;
  category?: string | null;
  createdAt?: string;
  info: Record<string, string>;
}

function resolveBoxComponent(boxStyle?: string): React.ComponentType<any> {
  const boxes = getAllRootPages().filter(
    (p) => p.type === "product-box" && p.slug === "dynamic"
  );
  if (!boxes.length) return ProductFlashBox;
  const found = boxes.find((b) => b.label === boxStyle);
  return found?.component ?? ProductFlashBox;
}

function BoxStyleSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [boxes, setBoxes] = useState<any[]>([]);

  useEffect(() => {
    const list = getAllRootPages().filter(
      (p) => p.type === "product-box" && p.slug === "dynamic"
    );
    setBoxes(list);
  }, []);

  const activeLabel = value || "Flash Sale Product Box";

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-gray-700">Card Box Template</label>
      <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
        {boxes.map((box) => {
          const isSelected =
            box.label === activeLabel || (value === "" && box.label === "Flash Sale Product Box");
          return (
            <button
              key={`${box.label}::${box.pluginNx}`}
              type="button"
              onClick={() => onChange(box.label)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-all ${
                isSelected
                  ? "border-orange-500 bg-orange-50 ring-1 ring-orange-400"
                  : "border-gray-200 bg-white hover:border-orange-200 hover:bg-orange-50/40"
              }`}
            >
              <span
                className={`shrink-0 w-3 h-3 rounded-full border-2 ${
                  isSelected ? "border-orange-500 bg-orange-500" : "border-gray-300 bg-white"
                }`}
              />
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-semibold leading-tight ${isSelected ? "text-orange-700" : "text-gray-700"}`}>
                  {box.label}
                </p>
                <p className="text-[10px] text-gray-400 truncate font-mono">{box.pluginNx}</p>
              </div>
              {isSelected && <Icon icon="mdi:check-circle" width={16} className="text-orange-500 shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CampaignSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [campaigns, setCampaigns] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/flash-sale?active=true", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { campaigns: [] }))
      .then((data) => {
        const list = Array.isArray(data.campaigns) ? data.campaigns : [];
        setCampaigns(list.filter((c: any) => c.targetType === "product"));
      })
      .catch(() => {});
  }, []);

  const options = [
    { value: "latest", label: "Latest Active Product Campaign" },
    ...campaigns.map((c) => ({ value: c._id, label: `${c.name} (${c.percentage}%)` })),
  ];

  return (
    <Select
      label="Active Product Campaign"
      value={value || "latest"}
      onChange={onChange}
      options={options}
    />
  );
}

function FlashSaleProductFrontend({ element }: { element: any }) {
  const s = element.schema;
  const sectionTitle = s.content?.section_title !== undefined ? s.content.section_title : "Flash Sale — Hot Products";
  const campaignId = s.content?.campaign_id || "latest";
  const boxStyle = s.content?.box_style || "Flash Sale Product Box";
  const displayMode = s.content?.display_mode || "grid";
  const limit = s.content?.limit ?? 12;
  const desktopCols = s.content?.desktop_cols ?? 6;
  const tabletCols = s.content?.tablet_cols ?? 4;
  const mobileCols = s.content?.mobile_cols ?? 2;

  const bgColor = s.style?.bg_color || "#ffffff";
  const insideGap = s.style?.inside_gap ?? 12;

  const [products, setProducts] = useState<ProductData[]>([]);
  const [campaign, setCampaign] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    containScroll: "trimSnaps",
    dragFree: true,
  });

  const scrollPrev = useCallback(() => emblaApi && emblaApi.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi && emblaApi.scrollNext(), [emblaApi]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    let isCancelled = false;
    setLoading(true);

    fetch("/api/flash-sale?active=true", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { campaigns: [] }))
      .then(async (data) => {
        if (isCancelled) return;
        const activeList: any[] = Array.isArray(data.campaigns) ? data.campaigns : [];
        const prodCampaigns = activeList.filter((c) => c.targetType === "product");

        if (prodCampaigns.length === 0) {
          setProducts([]);
          setCampaign(null);
          setLoading(false);
          return;
        }

        const activeCamp =
          campaignId !== "latest"
            ? prodCampaigns.find((c) => c._id === campaignId) || prodCampaigns[0]
            : prodCampaigns[0];

        setCampaign(activeCamp);

        const productIds: string[] = activeCamp.productIds || [];
        if (productIds.length === 0) {
          setProducts([]);
          setLoading(false);
          return;
        }

        try {
          const res = await xFetch(`/builder-post/products?ids=${productIds.join(",")}&limit=${limit}`);
          const prodData = await res.json();
          if (!isCancelled) {
            setProducts(prodData.products || []);
          }
        } catch {
          if (!isCancelled) setProducts([]);
        } finally {
          if (!isCancelled) setLoading(false);
        }
      })
      .catch(() => {
        if (!isCancelled) setLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [campaignId, limit]);

  if (!isMounted) return null;

  const BoxComponent = resolveBoxComponent(boxStyle);

  if (loading) {
    return (
      <div className="w-full py-8 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
        <Icon icon="svg-spinners:ring-resize" width={16} />
        Loading Product Flash Sale...
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="w-full py-8 px-4 text-center text-xs text-gray-400 border border-dashed border-gray-200 rounded-xl">
        No active product flash sale items found.
      </div>
    );
  }

  return (
    <div
      className="w-full transition-all duration-300"
      style={{ backgroundColor: bgColor }}
    >
      {sectionTitle && (
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Icon icon="solar:fire-bold" className="w-6 h-6 text-[#f3525a]" />
            <h3 className="text-lg md:text-xl font-bold tracking-tight text-gray-900">{sectionTitle}</h3>
          </div>
          <div className="flex items-center gap-3">
            {displayMode === "slider" && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={scrollPrev}
                  className="w-7 h-7 rounded-full bg-gray-100 hover:bg-orange-500 hover:text-white text-gray-600 flex items-center justify-center transition-colors shadow-xs"
                >
                  <Icon icon="mdi:chevron-left" width={18} />
                </button>
                <button
                  type="button"
                  onClick={scrollNext}
                  className="w-7 h-7 rounded-full bg-gray-100 hover:bg-orange-500 hover:text-white text-gray-600 flex items-center justify-center transition-colors shadow-xs"
                >
                  <Icon icon="mdi:chevron-right" width={18} />
                </button>
              </div>
            )}
            <Link
              href="/flash-sale"
              className="text-xs font-semibold text-[#f3525a] hover:underline flex items-center gap-1"
            >
              See All <Icon icon="mdi:chevron-right" className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}

      {/* GRID DISPLAY MODE */}
      {displayMode === "grid" ? (
        <>
          <style dangerouslySetInnerHTML={{ __html: `
            @media (max-width: 639px) {
              .flash-prod-grid-${element.id} {
                display: grid;
                grid-template-columns: repeat(${mobileCols}, minmax(0, 1fr));
              }
            }
            @media (min-width: 640px) and (max-width: 1023px) {
              .flash-prod-grid-${element.id} {
                display: grid;
                grid-template-columns: repeat(${tabletCols}, minmax(0, 1fr));
              }
            }
            @media (min-width: 1024px) {
              .flash-prod-grid-${element.id} {
                display: grid;
                grid-template-columns: repeat(${desktopCols}, minmax(0, 1fr));
              }
            }
          `}} />

          <div
            className={`flash-prod-grid-${element.id}`}
            style={{ gap: `${insideGap}px` }}
          >
            {products.map((p) => (
              <BoxComponent
                key={p._id}
                data={p}
                productUrl={`/product/${p.slug}`}
                flashSaleCampaign={campaign}
              />
            ))}
          </div>
        </>
      ) : (
        /* SLIDER DISPLAY MODE */
        <div className="overflow-hidden w-full" ref={emblaRef}>
          <div className="flex" style={{ gap: `${insideGap}px` }}>
            {products.map((p) => (
              <div
                key={p._id}
                className="min-w-0 flex flex-col shrink-0"
                style={{
                  width: `calc(${100 / desktopCols}% - ${(insideGap * (desktopCols - 1)) / desktopCols}px)`,
                }}
              >
                <BoxComponent
                  data={p}
                  productUrl={`/product/${p.slug}`}
                  flashSaleCampaign={campaign}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const flashSaleProductElement = {
  type: "flash-sale-product",
  category: "flash-sale",
  label: "Flash Sale (Product)",
  icon: "solar:fire-bold-duotone",

  schema: {
    content: {
      section_title: "Flash Sale — Hot Products",
      campaign_id: "latest",
      box_style: "Flash Sale Product Box",
      display_mode: "grid",
      limit: 12,
      desktop_cols: 6,
      tablet_cols: 4,
      mobile_cols: 2,
    },
    style: {
      bg_color: "#ffffff",
      inside_gap: 12,
    },
    advanced: {
      margin: { top: 0, right: 0, bottom: 0, left: 0, unit: "px" },
      padding: { top: 0, right: 0, bottom: 0, left: 0, unit: "px" },
    },
  },

  controls: [
    {
      tab: "Content",
      section: "Campaign & Layout Options",
      controls: [
        {
          name: "section_title",
          responsive: false,
          render: (value: any, onChange: any) => (
            <Text label="Section Title" value={value ?? "Flash Sale — Hot Products"} onChange={onChange} />
          ),
        },
        {
          name: "campaign_id",
          responsive: false,
          render: (value: any, onChange: any) => (
            <CampaignSelector value={value} onChange={onChange} />
          ),
        },
        {
          name: "display_mode",
          responsive: false,
          render: (value: any, onChange: any) => (
            <Select
              label="Display Layout Mode"
              value={value || "grid"}
              onChange={onChange}
              options={[
                { value: "grid", label: "Grid Layout" },
                { value: "slider", label: "Slider Carousel" },
              ]}
            />
          ),
        },
        {
          name: "box_style",
          responsive: false,
          render: (value: any, onChange: any) => (
            <BoxStyleSelector value={value} onChange={onChange} />
          ),
        },
        {
          name: "limit",
          responsive: false,
          render: (value: any, onChange: any) => (
            <NumberControl label="Max Products Limit" value={value ?? 12} onChange={onChange} min={1} max={40} />
          ),
        },
        {
          name: "desktop_cols",
          responsive: false,
          render: (value: any, onChange: any) => (
            <NumberControl label="Desktop Columns" value={value ?? 6} onChange={onChange} min={2} max={12} />
          ),
        },
        {
          name: "tablet_cols",
          responsive: false,
          render: (value: any, onChange: any) => (
            <NumberControl label="Tablet Columns" value={value ?? 4} onChange={onChange} min={2} max={8} />
          ),
        },
        {
          name: "mobile_cols",
          responsive: false,
          render: (value: any, onChange: any) => (
            <NumberControl label="Mobile Columns" value={value ?? 2} onChange={onChange} min={1} max={4} />
          ),
        },
      ],
    },
    {
      tab: "Style",
      section: "Colours & Spacing",
      controls: [
        {
          name: "bg_color",
          responsive: false,
          render: (value: any, onChange: any) => (
            <ColorPickerPopup label="Block Background" value={value ?? "#ffffff"} onChange={onChange} />
          ),
        },
        {
          name: "inside_gap",
          responsive: false,
          render: (value: any, onChange: any) => (
            <NumberControl label="Card Gap (px)" value={value ?? 12} onChange={onChange} min={0} max={40} />
          ),
        },
      ],
    },
  ],

  render: (element: any) => <FlashSaleProductFrontend element={element} />,
};

export default flashSaleProductElement;
