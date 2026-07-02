"use client";

/**
 * plugin/flash-sale/settings/FlashSaleManager.tsx
 *
 * Admin page registered at /admin/flash-sale
 *
 * Features:
 *  — Campaign list with active status indicator
 *  — Create / edit form inline (right-panel drawer style)
 *  — Campaign fields:
 *      name, image, icon, coverPhoto
 *      saleType (fake / real) with explanatory text
 *      percentage
 *      targetType (category / product)
 *      — if category: multi-select checkbox list of all product-categories
 *      — if product:  paginated product list with search + multi-select checkboxes
 *      isActive toggle, startDate, endDate
 */

import { useState, useEffect, useCallback } from "react";
import { Icon } from "@iconify/react";
import Gallery from "@/components/Gallery";
import { xFetch } from "@/lib/express";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Campaign {
    _id:         string;
    name:        string;
    image:       string;
    icon:        string;
    coverPhoto:  string;
    saleType:    "fake" | "real";
    percentage:  number;
    targetType:  "category" | "product";
    categoryIds: string[];
    productIds:  string[];
    isActive:    boolean;
    startDate:   string | null;
    endDate:     string | null;
}

interface CatItem  { _id: string; title: string; }
interface PostItem { _id: string; title: string; }

const EMPTY: Campaign = {
    _id: "", name: "", image: "", icon: "", coverPhoto: "",
    saleType: "real", percentage: 10,
    targetType: "product", categoryIds: [], productIds: [],
    isActive: true, startDate: null, endDate: null,
};

function toDateInput(iso: string | null): string {
    if (!iso) return "";
    try { return new Date(iso).toISOString().slice(0, 16); } catch { return ""; }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FlashSaleManager() {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loading,   setLoading]   = useState(true);
    const [panelOpen, setPanelOpen] = useState(false);
    const [form,      setForm]      = useState<Campaign>(EMPTY);
    const [saving,    setSaving]    = useState(false);
    const [message,   setMessage]   = useState("");

    // Target selection data
    const [categories, setCategories] = useState<CatItem[]>([]);
    const [products,   setProducts]   = useState<PostItem[]>([]);
    const [productSearch, setProductSearch] = useState("");
    const [catLoading,    setCatLoading]    = useState(false);
    const [prodLoading,   setProdLoading]   = useState(false);

    // ── Load campaigns ──────────────────────────────────────────────────────
    const loadCampaigns = useCallback(async () => {
        setLoading(true);
        try {
            const res  = await fetch("/api/flash-sale", { cache: "no-store" });
            const data = await res.json();
            setCampaigns(Array.isArray(data.campaigns) ? data.campaigns : []);
        } catch { /* ignore */ }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { loadCampaigns(); }, [loadCampaigns]);

    // ── Load categories (product-category type) ─────────────────────────────
    const loadCategories = useCallback(async () => {
        if (categories.length > 0) return;
        setCatLoading(true);
        try {
            const res  = await xFetch("/cat?type=product-category&status=published", { cache: "no-store" });
            const data = await res.json();
            setCategories(Array.isArray(data.cats) ? data.cats : []);
        } catch { /* ignore */ }
        finally { setCatLoading(false); }
    }, [categories.length]);

    // ── Load products ───────────────────────────────────────────────────────
    const loadProducts = useCallback(async (search = "") => {
        setProdLoading(true);
        try {
            const qs = new URLSearchParams({ type: "product", status: "published" });
            if (search.trim()) qs.set("search", search.trim());
            const res  = await xFetch(`/post?${qs}`, { cache: "no-store" });
            const data = await res.json();
            // Express returns { posts: [...] }; filter client-side by search if needed
            let list: PostItem[] = Array.isArray(data.posts) ? data.posts : [];
            if (search.trim()) {
                const q = search.trim().toLowerCase();
                list = list.filter(p => p.title.toLowerCase().includes(q));
            }
            setProducts(list);
        } catch { /* ignore */ }
        finally { setProdLoading(false); }
    }, []);

    // When panel opens, load target data based on targetType
    useEffect(() => {
        if (!panelOpen) return;
        if (form.targetType === "category") loadCategories();
        else loadProducts(productSearch);
    }, [panelOpen, form.targetType]);

    // Product search debounce
    useEffect(() => {
        if (form.targetType !== "product" || !panelOpen) return;
        const t = setTimeout(() => loadProducts(productSearch), 400);
        return () => clearTimeout(t);
    }, [productSearch, form.targetType, panelOpen]);

    // ── Handlers ─────────────────────────────────────────────────────────────

    const openNew = () => {
        setForm(EMPTY);
        setMessage("");
        setPanelOpen(true);
    };

    const openEdit = (c: Campaign) => {
        setForm({ ...c });
        setMessage("");
        setPanelOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this campaign? This cannot be undone.")) return;
        try {
            await fetch(`/api/flash-sale?id=${id}`, { method: "DELETE" });
            await loadCampaigns();
        } catch { /* ignore */ }
    };

    const handleSave = async () => {
        if (!form.name.trim()) { setMessage("Campaign name is required."); return; }
        if (form.percentage <= 0) { setMessage("Percentage must be > 0."); return; }

        setSaving(true);
        setMessage("");
        try {
            const isEdit = Boolean(form._id);
            const method = isEdit ? "PUT" : "POST";
            const body   = isEdit ? form : (({ _id, ...rest }) => rest)(form);

            const res  = await fetch("/api/flash-sale", {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const data = await res.json();

            if (!res.ok) {
                setMessage(data.error ?? "Failed to save.");
            } else {
                setMessage("Saved!");
                setPanelOpen(false);
                await loadCampaigns();
            }
        } catch {
            setMessage("Network error.");
        } finally {
            setSaving(false);
        }
    };

    const toggleId = (list: string[], id: string): string[] =>
        list.includes(id) ? list.filter(x => x !== id) : [...list, id];

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="space-y-6">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Flash Sale</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Create time-limited price campaigns — real discounts or fake markups.
                    </p>
                </div>
                <button
                    onClick={openNew}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold rounded-lg transition"
                >
                    <Icon icon="solar:add-circle-bold" width={16} />
                    New Campaign
                </button>
            </div>

            {/* Campaign list */}
            {loading ? (
                <div className="flex items-center justify-center py-20 text-gray-400">
                    <Icon icon="svg-spinners:ring-resize" width={32} />
                </div>
            ) : campaigns.length === 0 ? (
                <div className="text-center py-20 text-gray-400">
                    <Icon icon="solar:tag-price-bold" width={48} className="mx-auto mb-3 opacity-30" />
                    <p className="text-lg font-medium">No campaigns yet.</p>
                    <p className="text-sm mt-1">Click "New Campaign" to create your first flash sale.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {campaigns.map((c) => {
                        const active = c.isActive && (!c.endDate || new Date(c.endDate) > new Date());
                        return (
                            <div key={c._id}
                                className={`bg-white rounded-xl border shadow-sm p-4 space-y-3 relative overflow-hidden ${active ? "border-rose-200" : "border-gray-100"}`}>
                                {/* Cover photo strip */}
                                {c.coverPhoto && (
                                    <div className="absolute inset-x-0 top-0 h-16 overflow-hidden rounded-t-xl">
                                        <img src={c.coverPhoto} alt="" className="w-full h-full object-cover opacity-40" />
                                        <div className="absolute inset-0 bg-linear-to-b from-transparent to-white" />
                                    </div>
                                )}

                                <div className={`relative ${c.coverPhoto ? "pt-8" : ""}`}>
                                    {/* Status badge */}
                                    <span className={`absolute top-0 right-0 text-xs font-bold px-2 py-0.5 rounded-full ${active ? "bg-rose-100 text-rose-700" : "bg-gray-100 text-gray-500"}`}>
                                        {active ? "ACTIVE" : "INACTIVE"}
                                    </span>

                                    <div className="flex items-center gap-2 mb-2">
                                        {c.image && (
                                            <img src={c.image} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
                                        )}
                                        {c.icon && !c.image && (
                                            <Icon icon={c.icon} width={24} className="text-rose-600 shrink-0" />
                                        )}
                                        <h3 className="font-bold text-gray-900 text-sm truncate flex-1">{c.name}</h3>
                                    </div>

                                    <div className="flex flex-wrap gap-2 text-xs">
                                        <span className={`px-2 py-0.5 rounded-full font-semibold ${c.saleType === "fake" ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700"}`}>
                                            {c.saleType === "fake" ? "Fake Sale" : "Real Sale"}
                                        </span>
                                        <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold">
                                            {c.percentage}% off
                                        </span>
                                        <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                            {c.targetType === "category"
                                                ? `${c.categoryIds.length} categor${c.categoryIds.length !== 1 ? "ies" : "y"}`
                                                : `${c.productIds.length} product${c.productIds.length !== 1 ? "s" : ""}`}
                                        </span>
                                    </div>

                                    {(c.startDate || c.endDate) && (
                                        <p className="text-xs text-gray-400 mt-2">
                                            {c.startDate && `From ${new Date(c.startDate).toLocaleDateString()}`}
                                            {c.startDate && c.endDate && " · "}
                                            {c.endDate && `Until ${new Date(c.endDate).toLocaleDateString()}`}
                                        </p>
                                    )}

                                    <div className="flex gap-2 mt-3">
                                        <button onClick={() => openEdit(c)}
                                            className="flex-1 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 hover:bg-gray-50 transition">
                                            Edit
                                        </button>
                                        <button onClick={() => handleDelete(c._id)}
                                            className="py-1.5 px-3 text-xs font-semibold rounded-lg border border-red-100 text-red-500 hover:bg-red-50 transition">
                                            <Icon icon="solar:trash-bin-trash-bold" width={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Edit / Create panel */}
            {panelOpen && (
                <div className="fixed inset-0 z-50 flex">
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/40" onClick={() => setPanelOpen(false)} />

                    {/* Panel */}
                    <div className="relative ml-auto w-full max-w-xl bg-white shadow-2xl flex flex-col h-full overflow-y-auto">
                        {/* Panel header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
                            <h2 className="text-lg font-bold text-gray-900">
                                {form._id ? "Edit Campaign" : "New Campaign"}
                            </h2>
                            <button onClick={() => setPanelOpen(false)}
                                className="p-1.5 rounded-lg hover:bg-gray-100 transition">
                                <Icon icon="solar:close-bold" width={18} />
                            </button>
                        </div>

                        {/* Form body */}
                        <div className="flex-1 p-6 space-y-5">
                            {message && (
                                <div className={`rounded-lg px-4 py-3 text-sm font-medium border ${
                                    message.startsWith("Saved")
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                        : "bg-red-50 text-red-600 border-red-200"
                                }`}>
                                    {message}
                                </div>
                            )}

                            {/* Name */}
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-700">Campaign Name *</label>
                                <input type="text" value={form.name}
                                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    placeholder="e.g. Summer Flash Sale"
                                    className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-rose-500 outline-none" />
                            </div>

                            {/* Image / Icon / Cover */}
                            <div className="grid grid-cols-1 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-700">Campaign Image</label>
                                    <Gallery
                                        multiple={false}
                                        value={form.image}
                                        onChange={v => setForm(f => ({ ...f, image: typeof v === "string" ? v : (v[0] ?? "") }))}
                                        placeholder="Select image"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-700">Cover Photo</label>
                                    <Gallery
                                        multiple={false}
                                        value={form.coverPhoto}
                                        onChange={v => setForm(f => ({ ...f, coverPhoto: typeof v === "string" ? v : (v[0] ?? "") }))}
                                        placeholder="Select cover photo"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-700">Icon (Iconify key)</label>
                                    <input type="text" value={form.icon}
                                        onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
                                        placeholder="e.g. solar:tag-price-bold"
                                        className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-rose-500 outline-none" />
                                    {form.icon && (
                                        <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                                            Preview: <Icon icon={form.icon} width={18} />
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Sale Type */}
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-gray-700">Sale Type *</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {(["real", "fake"] as const).map((st) => (
                                        <label key={st}
                                            className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition ${
                                                form.saleType === st
                                                    ? "border-rose-500 bg-rose-50"
                                                    : "border-gray-200 hover:border-rose-300"
                                            }`}>
                                            <input type="radio" name="saleType" value={st}
                                                checked={form.saleType === st}
                                                onChange={() => setForm(f => ({ ...f, saleType: st }))}
                                                className="mt-0.5 accent-rose-600" />
                                            <div>
                                                <p className="text-sm font-semibold capitalize">{st} Sale</p>
                                                <p className="text-xs text-gray-500 mt-0.5">
                                                    {st === "real"
                                                        ? "Genuine markdown. e.g. 100 → 90 at 10%."
                                                        : "Inflate displayed price. e.g. shows ~~110~~ → 100 at 10%."}
                                                </p>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Percentage */}
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-700">
                                    Discount Percentage (0–100) *
                                </label>
                                <div className="flex items-center gap-2">
                                    <input type="number" min={0} max={100} step={0.1}
                                        value={form.percentage}
                                        onChange={e => setForm(f => ({ ...f, percentage: parseFloat(e.target.value) || 0 }))}
                                        className="w-32 px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-rose-500 outline-none" />
                                    <span className="text-sm font-bold text-rose-600">%</span>
                                </div>
                            </div>

                            {/* Target Type */}
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-gray-700">Apply To</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {(["product", "category"] as const).map((tt) => (
                                        <label key={tt}
                                            className={`flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition ${
                                                form.targetType === tt
                                                    ? "border-rose-500 bg-rose-50"
                                                    : "border-gray-200 hover:border-rose-300"
                                            }`}>
                                            <input type="radio" name="targetType" value={tt}
                                                checked={form.targetType === tt}
                                                onChange={() => setForm(f => ({
                                                    ...f,
                                                    targetType:  tt,
                                                    categoryIds: [],
                                                    productIds:  [],
                                                }))}
                                                className="accent-rose-600" />
                                            <span className="text-sm font-semibold capitalize">{tt} wise</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Category selector */}
                            {form.targetType === "category" && (
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-gray-700">
                                        Select Categories ({form.categoryIds.length} selected)
                                    </label>
                                    {catLoading ? (
                                        <div className="flex items-center gap-2 text-gray-400 text-sm py-4">
                                            <Icon icon="svg-spinners:ring-resize" width={16} /> Loading categories…
                                        </div>
                                    ) : categories.length === 0 ? (
                                        <p className="text-sm text-gray-400 py-4">No categories found.</p>
                                    ) : (
                                        <div className="max-h-56 overflow-y-auto border rounded-xl divide-y divide-gray-100">
                                            {categories.map(cat => (
                                                <label key={cat._id}
                                                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer">
                                                    <input type="checkbox"
                                                        checked={form.categoryIds.includes(cat._id)}
                                                        onChange={() => setForm(f => ({
                                                            ...f,
                                                            categoryIds: toggleId(f.categoryIds, cat._id),
                                                        }))}
                                                        className="w-4 h-4 accent-rose-600 rounded" />
                                                    <span className="text-sm text-gray-800">{cat.title}</span>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Product selector */}
                            {form.targetType === "product" && (
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-gray-700">
                                        Select Products ({form.productIds.length} selected)
                                    </label>
                                    <input type="text" value={productSearch}
                                        onChange={e => setProductSearch(e.target.value)}
                                        placeholder="Search products…"
                                        className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-rose-500 outline-none" />
                                    {prodLoading ? (
                                        <div className="flex items-center gap-2 text-gray-400 text-sm py-4">
                                            <Icon icon="svg-spinners:ring-resize" width={16} /> Loading products…
                                        </div>
                                    ) : products.length === 0 ? (
                                        <p className="text-sm text-gray-400 py-4">No products found.</p>
                                    ) : (
                                        <div className="max-h-56 overflow-y-auto border rounded-xl divide-y divide-gray-100">
                                            {products.map(p => (
                                                <label key={p._id}
                                                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer">
                                                    <input type="checkbox"
                                                        checked={form.productIds.includes(p._id)}
                                                        onChange={() => setForm(f => ({
                                                            ...f,
                                                            productIds: toggleId(f.productIds, p._id),
                                                        }))}
                                                        className="w-4 h-4 accent-rose-600 rounded" />
                                                    <span className="text-sm text-gray-800">{p.title}</span>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Active + dates */}
                            <div className="space-y-3">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <button type="button" role="switch" aria-checked={form.isActive}
                                        onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
                                        className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${form.isActive ? "bg-rose-500" : "bg-gray-200"}`}>
                                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isActive ? "translate-x-6" : "translate-x-1"}`} />
                                    </button>
                                    <span className="text-sm font-semibold text-gray-700">Active</span>
                                </label>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-gray-700">Start Date (optional)</label>
                                        <input type="datetime-local"
                                            value={toDateInput(form.startDate)}
                                            onChange={e => setForm(f => ({ ...f, startDate: e.target.value ? new Date(e.target.value).toISOString() : null }))}
                                            className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-rose-500" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-gray-700">End Date (optional)</label>
                                        <input type="datetime-local"
                                            value={toDateInput(form.endDate)}
                                            onChange={e => setForm(f => ({ ...f, endDate: e.target.value ? new Date(e.target.value).toISOString() : null }))}
                                            className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-rose-500" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Panel footer */}
                        <div className="px-6 py-4 border-t border-gray-100 bg-white sticky bottom-0">
                            <button onClick={handleSave} disabled={saving}
                                className="w-full py-3 bg-rose-600 hover:bg-rose-500 disabled:opacity-55 text-white font-semibold rounded-xl transition flex items-center justify-center gap-2">
                                {saving
                                    ? <><Icon icon="svg-spinners:ring-resize" width={16} /> Saving…</>
                                    : <><Icon icon="solar:check-circle-bold" width={16} /> {form._id ? "Save Changes" : "Create Campaign"}</>
                                }
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
