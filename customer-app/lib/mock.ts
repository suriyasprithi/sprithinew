// Mock data + simulated API calls for screens whose backend tables don't exist
// in epey_v2 yet (Phases 2–7 will land them). Each helper has a comment naming
// the real endpoint to swap in. Grep "MOCK — replace" to find them.
//
// Pattern at the page:
//   const data = await mock.getProducts();   // MOCK — replace with api.get("/catalog/products")

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));

// ----- Catalog -----------------------------------------------------------

export type MockProduct = {
  id: number;
  name: string;
  description: string;
  price: number;
  image: string;
  vendor_id: number;
  vendor_name: string;
  category_id: number;
  category_name: string;
  stock: number;
  has_variants: boolean;
  attributes?: Record<string, string | number>;
};

export type MockVariant = { id: number; name: string; price: number; stock: number };

const products: MockProduct[] = [
  { id: 1, name: "Sona Masuri Rice 5kg", description: "Premium short-grain rice from local farms.", price: 380, image: "", vendor_id: 10, vendor_name: "Annapurna Stores", category_id: 1, category_name: "Grocery", stock: 24, has_variants: true, attributes: { weight_kg: 5 } },
  { id: 2, name: "Cold-pressed Coconut Oil 1L", description: "Wood-pressed virgin oil.", price: 450, image: "", vendor_id: 10, vendor_name: "Annapurna Stores", category_id: 1, category_name: "Grocery", stock: 12, has_variants: false },
  { id: 3, name: "Organic Turmeric Powder 250g", description: "Single-origin Erode turmeric.", price: 95, image: "", vendor_id: 11, vendor_name: "Spice Bazaar", category_id: 1, category_name: "Grocery", stock: 50, has_variants: false, attributes: { weight_g: 250 } },
  { id: 4, name: "Cotton T-shirt", description: "Round neck, regular fit.", price: 549, image: "", vendor_id: 12, vendor_name: "Comfort Wear", category_id: 2, category_name: "Apparel", stock: 30, has_variants: true },
  { id: 5, name: "Smart LED Bulb 9W", description: "Wi-Fi controlled, 16M colors.", price: 699, image: "", vendor_id: 13, vendor_name: "Bright Electronics", category_id: 3, category_name: "Electronics", stock: 8, has_variants: false },
  { id: 6, name: "Stainless Steel Lunch Box", description: "Three-compartment, leakproof.", price: 320, image: "", vendor_id: 14, vendor_name: "HomeKart", category_id: 4, category_name: "Home", stock: 45, has_variants: false },
];

const variantsByProduct: Record<number, MockVariant[]> = {
  1: [
    { id: 11, name: "1 kg",  price: 80,  stock: 100 },
    { id: 12, name: "5 kg",  price: 380, stock: 24 },
    { id: 13, name: "10 kg", price: 740, stock: 10 },
  ],
  4: [
    { id: 41, name: "S", price: 549, stock: 8 },
    { id: 42, name: "M", price: 549, stock: 12 },
    { id: 43, name: "L", price: 549, stock: 6 },
    { id: 44, name: "XL", price: 599, stock: 4 },
  ],
};

export type MockCategory = { id: number; name: string; commission_pct: number };
const categories: MockCategory[] = [
  { id: 1, name: "Grocery",    commission_pct: 3 },
  { id: 2, name: "Apparel",    commission_pct: 5 },
  { id: 3, name: "Electronics",commission_pct: 4 },
  { id: 4, name: "Home",       commission_pct: 4 },
];

export type MockShop = { id: number; name: string; area: string; pincode: string; image: string; product_count: number };
const shops: MockShop[] = [
  { id: 10, name: "Annapurna Stores",   area: "Gandhipuram", pincode: "641012", image: "", product_count: 38 },
  { id: 11, name: "Spice Bazaar",       area: "Town Hall",    pincode: "641001", image: "", product_count: 22 },
  { id: 12, name: "Comfort Wear",       area: "Race Course", pincode: "641018", image: "", product_count: 65 },
  { id: 13, name: "Bright Electronics", area: "RS Puram",    pincode: "641002", image: "", product_count: 19 },
  { id: 14, name: "HomeKart",           area: "Saibaba Colony",pincode: "641011", image: "", product_count: 41 },
];

// ----- Cart --------------------------------------------------------------

export type MockCartItem = {
  id: number; product_id: number; variation_id?: number | null; variation_label?: string | null;
  name: string; price: number; qty: number; image: string;
};

let cart: MockCartItem[] = [
  { id: 1, product_id: 1, variation_id: 12, variation_label: "5 kg", name: "Sona Masuri Rice", price: 380, qty: 1, image: "" },
  { id: 2, product_id: 3, variation_id: null, variation_label: null, name: "Organic Turmeric Powder 250g", price: 95, qty: 2, image: "" },
];

// ----- Orders ------------------------------------------------------------

export type MockOrderStatus = "pending" | "paid" | "shipped" | "delivered" | "cancelled";
export type MockOrder = {
  id: number; total: number; delivery_fee: number; status: MockOrderStatus;
  vendor_name: string; created_at: string; item_count: number;
};

const orders: MockOrder[] = [
  { id: 1042, total: 570,  delivery_fee: 30, status: "delivered", vendor_name: "Annapurna Stores",   created_at: "2026-05-09 11:42", item_count: 2 },
  { id: 1051, total: 320,  delivery_fee: 25, status: "shipped",   vendor_name: "HomeKart",            created_at: "2026-05-11 17:08", item_count: 1 },
  { id: 1062, total: 1149, delivery_fee: 40, status: "paid",      vendor_name: "Bright Electronics", created_at: "2026-05-13 09:14", item_count: 2 },
];

// ----- Wallet transactions ----------------------------------------------

export type MockTxn = {
  id: number; type: string; amount: number; reference: string; notes: string | null; created_at: string;
};
const txns: MockTxn[] = [
  { id: 90, type: "welcome_bonus", amount: 15,  reference: "signup#42", notes: "Welcome bonus for referring",     created_at: "2026-05-12 09:00" },
  { id: 91, type: "payment",       amount: -570,reference: "order#1042",notes: "Order #1042",                     created_at: "2026-05-09 11:42" },
  { id: 92, type: "topup",         amount: 1000,reference: "manual#21", notes: "Manual top-up approved",          created_at: "2026-05-08 18:33" },
];

// ----- Referrals ---------------------------------------------------------

export type MockReferral = { id: number; mobile_number: string; name: string; joined_at: string; bonus_amount: number; level: 1 | 2 | 3 };
const referrals: MockReferral[] = [
  { id: 50, mobile_number: "9876543210", name: "Asha M.",   joined_at: "2026-05-10", bonus_amount: 15, level: 1 },
  { id: 51, mobile_number: "9876543212", name: "Karthik R.",joined_at: "2026-05-12", bonus_amount: 15, level: 1 },
];

// ----- Subscriptions / Lucky-draw / Wishlist (light placeholders) -------
// (These remain as routes for now — they will be removed in a later cleanup pass.)

export const mock = {
  // catalog
  async getProducts(opts?: { q?: string; category_id?: number; vendor_id?: number }): Promise<MockProduct[]> {
    await delay();
    let r = [...products];
    if (opts?.q) {
      const q = opts.q.toLowerCase();
      r = r.filter((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
    }
    if (opts?.category_id) r = r.filter((p) => p.category_id === opts.category_id);
    if (opts?.vendor_id)   r = r.filter((p) => p.vendor_id === opts.vendor_id);
    return r;
  },
  async getProduct(id: number): Promise<{ product: MockProduct; variants: MockVariant[] } | null> {
    await delay();
    const p = products.find((x) => x.id === id);
    if (!p) return null;
    return { product: p, variants: variantsByProduct[id] || [] };
  },
  async getCategories(): Promise<MockCategory[]> { await delay(); return [...categories]; },
  async getShops(opts?: { q?: string }): Promise<MockShop[]> {
    await delay();
    let r = [...shops];
    if (opts?.q) {
      const q = opts.q.toLowerCase();
      r = r.filter((s) => s.name.toLowerCase().includes(q) || s.area.toLowerCase().includes(q));
    }
    return r;
  },
  async getShop(id: number): Promise<{ shop: MockShop; products: MockProduct[] } | null> {
    await delay();
    const s = shops.find((x) => x.id === id);
    if (!s) return null;
    return { shop: s, products: products.filter((p) => p.vendor_id === id) };
  },

  // cart
  async getCart(): Promise<MockCartItem[]> { await delay(); return [...cart]; },
  async addToCart(it: { product_id: number; variation_id?: number | null; variation_label?: string | null; name: string; price: number; qty: number }): Promise<void> {
    await delay();
    const existing = cart.find((x) => x.product_id === it.product_id && x.variation_id === (it.variation_id ?? null));
    if (existing) {
      existing.qty += it.qty;
    } else {
      cart.push({ id: Date.now(), image: "", variation_id: it.variation_id ?? null, variation_label: it.variation_label ?? null, ...it });
    }
  },
  async setQty(id: number, qty: number): Promise<void> { await delay(); cart = cart.map((c) => (c.id === id ? { ...c, qty } : c)); },
  async removeItem(id: number): Promise<void> { await delay(); cart = cart.filter((c) => c.id !== id); },
  async clearCart(): Promise<void> { await delay(); cart = []; },

  // orders
  async getOrders(): Promise<MockOrder[]> { await delay(); return [...orders]; },
  async getOrder(id: number): Promise<MockOrder | null> { await delay(); return orders.find((o) => o.id === id) || null; },
  async placeOrder(): Promise<{ order_id: number }> {
    await delay(400);
    const id = Math.max(...orders.map((o) => o.id)) + 1;
    orders.unshift({ id, total: cart.reduce((s, i) => s + i.price * i.qty, 0), delivery_fee: 25, status: "paid", vendor_name: "Annapurna Stores", created_at: new Date().toISOString().slice(0, 16).replace("T", " "), item_count: cart.length });
    cart = [];
    return { order_id: id };
  },

  // wallet
  async getTransactions(): Promise<MockTxn[]> { await delay(); return [...txns]; },

  // referrals
  async getReferrals(): Promise<MockReferral[]> { await delay(); return [...referrals]; },
};
