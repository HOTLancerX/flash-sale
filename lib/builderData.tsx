import { registerBuilderElement } from "@/hook/builderDataHooks";
import connectDB from "@/lib/mongodb";
import FlashSaleCampaign from "@/plugin/flash-sale/models/FlashSale";
import Post from "@/models/post";
import PostInfo from "@/models/post_info";
import Permalink from "@/models/permalink";
import ProductFlashBox from "../box/Product-flash";
import { getAllRootPages } from "@/hook";
import mongoose from "mongoose";

function toOid(id: string): mongoose.Types.ObjectId | null {
  try {
    return new mongoose.Types.ObjectId(id);
  } catch {
    return null;
  }
}

function isNowActive(c: any): boolean {
  if (!c.isActive) return false;
  const now = new Date();
  if (c.startDate && new Date(c.startDate) > now) return false;
  if (c.endDate && new Date(c.endDate) < now) return false;
  return true;
}

function resolveBoxComponent(boxStyle?: string): React.ComponentType<any> {
  const boxes = getAllRootPages().filter(
    (p) => p.type === "product-box" && p.slug === "dynamic"
  );
  if (!boxes.length) return ProductFlashBox;
  if (boxStyle) {
    const found = boxes.find((b) => b.label === boxStyle);
    if (found?.component) return found.component;
  }
  return (boxes.find((b) => b.active === true) ?? boxes[0])?.component ?? ProductFlashBox;
}

// ── flash-sale-category server component ─────────────────────────────────────
registerBuilderElement("flash-sale-category", async (schema) => {
  await connectDB();
  const c = schema?.content ?? {};
  const s = schema?.style ?? {};

  const title = c.section_title !== undefined ? c.section_title : "Flash Sale — Category Deals";
  const limit = c.limit ?? 12;
  const desktopCols = c.desktop_cols ?? 6;
  const tabletCols = c.tablet_cols ?? 4;
  const mobileCols = c.mobile_cols ?? 2;
  const bgColor = s.bg_color || "#ffffff";
  const insideGap = s.inside_gap ?? 12;
  const boxStyle = c.box_style || "Flash Sale Product Box";

  const permalinkDoc = (await Permalink.findOne({ contentType: "product" }).lean()) as any;
  const productPrefix = (permalinkDoc?.prefix ?? "product").trim().replace(/^\/+|\/+$/g, "");
  const getProductUrl = (slug: string) => productPrefix ? `/${productPrefix}/${slug}` : `/${slug}`;

  const BoxComponent = resolveBoxComponent(boxStyle);

  // Query active category campaign
  const campaigns = (await FlashSaleCampaign.find({ isActive: true }).lean()) as any[];
  const activeCatCampaigns = campaigns.filter((camp) => isNowActive(camp) && camp.targetType === "category");

  if (!activeCatCampaigns.length) return null;

  const campaign = activeCatCampaigns[0];
  const catIds = campaign.categoryIds || [];
  const catOids = catIds.map(toOid).filter(Boolean) as mongoose.Types.ObjectId[];

  if (!catOids.length) return null;

  // Fetch products in these categories
  const posts = (await Post.find({
    category: { $in: catOids },
    type: "product",
    status: "published",
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean()) as any[];

  if (!posts.length) return null;

  const infoDocs = (await PostInfo.find({
    postId: { $in: posts.map((p: any) => p._id) },
  }).lean()) as any[];

  const infoByPost: Record<string, Record<string, string>> = {};
  for (const r of infoDocs) {
    const key = String(r.postId);
    if (!infoByPost[key]) infoByPost[key] = {};
    infoByPost[key][r.name] = r.value;
  }

  const products = posts.map((p: any) => ({
    _id: String(p._id),
    title: String(p.title ?? ""),
    slug: String(p.slug ?? ""),
    status: "published",
    category: p.category ? String(p.category) : null,
    info: infoByPost[String(p._id)] ?? {},
  }));

  const campObj = {
    ...campaign,
    _id: String(campaign._id),
    startDate: campaign.startDate ? new Date(campaign.startDate).toISOString() : null,
    endDate: campaign.endDate ? new Date(campaign.endDate).toISOString() : null,
  };

  return (
    <div className="w-full py-6 px-4 md:px-6 rounded-2xl transition-all duration-300" style={{ backgroundColor: bgColor }}>
      {title && (
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#f3525a] animate-ping" />
            <h3 className="text-lg md:text-xl font-bold tracking-tight text-gray-900">{title}</h3>
          </div>
        </div>
      )}
      <style dangerouslySetInnerHTML={{ __html: `
        @media (min-width: 640px) {
          .flash-cat-grid-sr {
            display: grid;
            grid-template-columns: repeat(${tabletCols}, minmax(0, 1fr));
          }
        }
        @media (min-width: 1024px) {
          .flash-cat-grid-sr {
            display: grid;
            grid-template-columns: repeat(${desktopCols}, minmax(0, 1fr));
          }
        }
      `}} />
      <div className="hidden sm:grid flash-cat-grid-sr" style={{ gap: `${insideGap}px` }}>
        {products.map((p) => (
          <BoxComponent
            key={p._id}
            data={p}
            productUrl={getProductUrl(p.slug)}
            flashSaleCampaign={campObj}
          />
        ))}
      </div>
      <div className="flex sm:hidden overflow-x-auto gap-3 pb-2">
        {products.map((p) => (
          <div key={p._id} className="min-w-37.5 flex-1">
            <BoxComponent
              data={p}
              productUrl={getProductUrl(p.slug)}
              flashSaleCampaign={campObj}
            />
          </div>
        ))}
      </div>
    </div>
  );
});

// ── flash-sale-product server component ──────────────────────────────────────
registerBuilderElement("flash-sale-product", async (schema) => {
  await connectDB();
  const c = schema?.content ?? {};
  const s = schema?.style ?? {};

  const title = c.section_title !== undefined ? c.section_title : "Flash Sale — Hot Products";
  const limit = c.limit ?? 12;
  const desktopCols = c.desktop_cols ?? 6;
  const tabletCols = c.tablet_cols ?? 4;
  const mobileCols = c.mobile_cols ?? 2;
  const bgColor = s.bg_color || "#ffffff";
  const insideGap = s.inside_gap ?? 12;
  const boxStyle = c.box_style || "Flash Sale Product Box";

  const permalinkDoc = (await Permalink.findOne({ contentType: "product" }).lean()) as any;
  const productPrefix = (permalinkDoc?.prefix ?? "product").trim().replace(/^\/+|\/+$/g, "");
  const getProductUrl = (slug: string) => productPrefix ? `/${productPrefix}/${slug}` : `/${slug}`;

  const BoxComponent = resolveBoxComponent(boxStyle);

  // Query active product campaign
  const campaigns = (await FlashSaleCampaign.find({ isActive: true }).lean()) as any[];
  const activeProdCampaigns = campaigns.filter((camp) => isNowActive(camp) && camp.targetType === "product");

  if (!activeProdCampaigns.length) return null;

  const campaign = activeProdCampaigns[0];
  const prodIds = campaign.productIds || [];
  const prodOids = prodIds.map(toOid).filter(Boolean) as mongoose.Types.ObjectId[];

  if (!prodOids.length) return null;

  // Fetch products by product IDs
  const posts = (await Post.find({
    _id: { $in: prodOids },
    type: "product",
    status: "published",
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean()) as any[];

  if (!posts.length) return null;

  const infoDocs = (await PostInfo.find({
    postId: { $in: posts.map((p: any) => p._id) },
  }).lean()) as any[];

  const infoByPost: Record<string, Record<string, string>> = {};
  for (const r of infoDocs) {
    const key = String(r.postId);
    if (!infoByPost[key]) infoByPost[key] = {};
    infoByPost[key][r.name] = r.value;
  }

  const products = posts.map((p: any) => ({
    _id: String(p._id),
    title: String(p.title ?? ""),
    slug: String(p.slug ?? ""),
    status: "published",
    category: p.category ? String(p.category) : null,
    info: infoByPost[String(p._id)] ?? {},
  }));

  const campObj = {
    ...campaign,
    _id: String(campaign._id),
    startDate: campaign.startDate ? new Date(campaign.startDate).toISOString() : null,
    endDate: campaign.endDate ? new Date(campaign.endDate).toISOString() : null,
  };

  return (
    <div className="w-full">
      {title && (
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#f3525a] animate-ping" />
            <h3 className="text-lg md:text-xl font-bold tracking-tight text-gray-900">{title}</h3>
          </div>
        </div>
      )}
      <style dangerouslySetInnerHTML={{ __html: `
        @media (min-width: 640px) {
          .flash-prod-grid-sr {
            display: grid;
            grid-template-columns: repeat(${tabletCols}, minmax(0, 1fr));
          }
        }
        @media (min-width: 1024px) {
          .flash-prod-grid-sr {
            display: grid;
            grid-template-columns: repeat(${desktopCols}, minmax(0, 1fr));
          }
        }
      `}} />
      <div className="hidden sm:grid flash-prod-grid-sr" style={{ gap: `${insideGap}px` }}>
        {products.map((p) => (
          <BoxComponent
            key={p._id}
            data={p}
            productUrl={getProductUrl(p.slug)}
            flashSaleCampaign={campObj}
          />
        ))}
      </div>
      <div className="flex sm:hidden overflow-x-auto gap-3 pb-2">
        {products.map((p) => (
          <div key={p._id} className="min-w-37.5 flex-1">
            <BoxComponent
              data={p}
              productUrl={getProductUrl(p.slug)}
              flashSaleCampaign={campObj}
            />
          </div>
        ))}
      </div>
    </div>
  );
});

