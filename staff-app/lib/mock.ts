// Staff-app mock layer. Same convention as customer-app:
//   const data = await mock.adminPendingPayments();   // MOCK — replace with api.get(...)
const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));

// ----- Stats -----------------------------------------------------------------

export type ChartPoint = { label: string; value: number };
export type ActivityRow = { name: string; sub: string; amount?: string; delta?: number };

export type StaffStats = {
  customers?: number;
  vendors?: number;
  todays_orders?: number;
  todays_revenue?: number;
  pending_payments?: number;
  pending_withdrawals?: number;
  tokens_issued?: number;
  tokens_received?: number;
  active_products?: number;
  wallet?: number;
  bonus?: number;
  qr_wallet?: number;
  team_below?: number;
  pending_deliveries?: number;
  delivered_today?: number;
  total_delivered?: number;
  monthly_salary?: number;
  chart_title?: string;
  chart_unit?: string;
  chart_series?: ChartPoint[];
  activity_title?: string;
  activity_rows?: ActivityRow[];
};

const seriesAdmin: ChartPoint[] = [
  { label: "05-02", value:  9 }, { label: "05-03", value: 12 }, { label: "05-04", value:  7 },
  { label: "05-05", value: 14 }, { label: "05-06", value: 11 }, { label: "05-07", value: 18 },
  { label: "05-08", value: 13 }, { label: "05-09", value: 16 }, { label: "05-10", value: 22 },
  { label: "05-11", value: 19 }, { label: "05-12", value: 24 }, { label: "05-13", value: 21 },
  { label: "05-14", value: 27 }, { label: "05-15", value: 15 },
];
const seriesVendor: ChartPoint[] = [
  { label: "05-02", value: 3 }, { label: "05-03", value: 5 }, { label: "05-04", value: 2 },
  { label: "05-05", value: 6 }, { label: "05-06", value: 4 }, { label: "05-07", value: 8 },
  { label: "05-08", value: 5 }, { label: "05-09", value: 7 }, { label: "05-10", value: 9 },
  { label: "05-11", value: 6 }, { label: "05-12", value: 8 }, { label: "05-13", value: 7 },
  { label: "05-14", value: 9 }, { label: "05-15", value: 7 },
];
const seriesTaluk: ChartPoint[] = [
  { label: "W1", value:  900 }, { label: "W2", value: 1200 }, { label: "W3", value: 1100 },
  { label: "W4", value: 1500 }, { label: "W5", value: 1800 }, { label: "W6", value: 1400 },
  { label: "W7", value: 2200 },
];
const seriesDistrict: ChartPoint[] = [
  { label: "W1", value: 2400 }, { label: "W2", value: 3100 }, { label: "W3", value: 2800 },
  { label: "W4", value: 4200 }, { label: "W5", value: 4600 }, { label: "W6", value: 3900 },
  { label: "W7", value: 5400 },
];
const seriesState: ChartPoint[] = [
  { label: "W1", value:  7200 }, { label: "W2", value:  9100 }, { label: "W3", value:  8800 },
  { label: "W4", value: 11200 }, { label: "W5", value: 13400 }, { label: "W6", value: 12100 },
  { label: "W7", value: 16500 },
];

const activityAdmin: ActivityRow[] = [
  { name: "Grocery",        sub: "₹8,420 revenue",  delta:  3.4 },
  { name: "Electronics",    sub: "₹5,210 revenue",  delta:  1.1 },
  { name: "Apparel",        sub: "₹2,880 revenue",  delta: -0.6 },
  { name: "Home & Kitchen", sub: "₹1,940 revenue",  delta:  2.2 },
  { name: "Beauty",         sub: "₹990 revenue",    delta: -1.4 },
];
const activityVendor: ActivityRow[] = [
  { name: "Asha M.",     sub: "2 items · paid",       amount: "₹1,149" },
  { name: "Karthik R.",  sub: "1 item · shipped",     amount: "₹320" },
  { name: "Vimal P.",    sub: "2 items · delivered",  amount: "₹570" },
  { name: "Priya S.",    sub: "1 item · paid",        amount: "₹460" },
  { name: "Rahul K.",    sub: "3 items · pending",    amount: "₹880" },
];
const activityTaluk: ActivityRow[] = [
  { name: "Annapurna Stores", sub: "Coimbatore South", amount: "1,200 tokens" },
  { name: "Spice Bazaar",     sub: "Coimbatore South", amount: "950 tokens" },
  { name: "Comfort Wear",     sub: "Coimbatore South", amount: "800 tokens" },
  { name: "Bright Electronics", sub: "Coimbatore South", amount: "650 tokens" },
];
const activityDistrict: ActivityRow[] = [
  { name: "Coimbatore South", sub: "12 vendors", amount: "4,400 tokens" },
  { name: "Coimbatore North", sub: "8 vendors",  amount: "3,100 tokens" },
  { name: "Pollachi",         sub: "6 vendors",  amount: "2,400 tokens" },
  { name: "Mettupalayam",     sub: "4 vendors",  amount: "1,800 tokens" },
];
const activityState: ActivityRow[] = [
  { name: "Coimbatore", sub: "4 taluks",  amount: "12,200 tokens" },
  { name: "Chennai",    sub: "5 taluks",  amount:  "9,800 tokens" },
  { name: "Madurai",    sub: "3 taluks",  amount:  "7,400 tokens" },
  { name: "Salem",      sub: "3 taluks",  amount:  "5,600 tokens" },
];

const statsByRole: Record<string, StaffStats> = {
  vendor: {
    todays_orders: 7, active_products: 23, tokens_received: 1200, wallet: 14820,
    chart_title: "Orders — last 14 days", chart_unit: "orders",
    chart_series: seriesVendor,
    activity_title: "Recent orders", activity_rows: activityVendor,
  },
  taluk: {
    tokens_issued: 4400, tokens_received: 6000, vendors: 18, wallet: 9120,
    chart_title: "Tokens issued — last 7 weeks", chart_unit: "tokens",
    chart_series: seriesTaluk,
    activity_title: "Top vendors", activity_rows: activityTaluk,
  },
  district: {
    tokens_issued: 12200, tokens_received: 16000, team_below: 6, wallet: 14500,
    chart_title: "Tokens issued — last 7 weeks", chart_unit: "tokens",
    chart_series: seriesDistrict,
    activity_title: "Top taluks", activity_rows: activityDistrict,
  },
  state: {
    tokens_issued: 35000, tokens_received: 50000, team_below: 11, wallet: 22300,
    chart_title: "Tokens issued — last 7 weeks", chart_unit: "tokens",
    chart_series: seriesState,
    activity_title: "Top districts", activity_rows: activityState,
  },
  admin: {
    customers: 124, vendors: 21, todays_orders: 15, todays_revenue: 18450,
    pending_payments: 3, pending_withdrawals: 2,
    chart_title: "Orders — last 14 days", chart_unit: "orders",
    chart_series: seriesAdmin,
    activity_title: "Top categories", activity_rows: activityAdmin,
  },
};

// ----- Vendor / orders / products (vendor pov) -------------------------------

export type VendorOrder = {
  id: number; customer_name: string; status: "pending"|"confirmed"|"packed"|"shipped"|"delivered"|"paid"|"completed"|"cancelled";
  total: number; created_at: string; item_count: number; product_names?: string | null;
  cancel_reason?: string | null; cancelled_by?: string | null;
};
const vendorOrders: VendorOrder[] = [
  { id: 1062, customer_name: "Asha M.",     status: "paid",      total: 1149, created_at: "2026-05-13 09:14", item_count: 2 },
  { id: 1051, customer_name: "Karthik R.", status: "shipped",   total: 320,  created_at: "2026-05-11 17:08", item_count: 1 },
  { id: 1042, customer_name: "Vimal P.",   status: "delivered", total: 570,  created_at: "2026-05-09 11:42", item_count: 2 },
];

export type AttributeFieldType = "text" | "textarea" | "number" | "date" | "select" | "toggle" | "image" | "color";

export type AttributeField = {
  key: string;
  label: string;
  type: AttributeFieldType;
  required?: boolean;
  options?: string[];   // for select
  unit?: string;        // for number (e.g. "kg", "mAh")
  placeholder?: string;
};

export type AttributeSchema = AttributeField[];

export type ProductAttributes = Record<string, string | number | boolean | string[] | null>;

export type VendorCategoryFull = {
  id: number;
  name: string;
  image: string | null;
  status: "active" | "inactive";
  free_delivery_min?: number;
  delivery_charge?: number;
  gst_rate?: number;
  attribute_schema: AttributeSchema;
};

const vendorCategoriesFull: VendorCategoryFull[] = [
  {
    id: 1, name: "Grocery", image: null, status: "active",
    attribute_schema: [
      { key: "weight",        label: "Weight",         type: "number",  unit: "kg", required: true },
      { key: "brand",         label: "Brand",          type: "text" },
      { key: "expiry_date",   label: "Expiry date",    type: "date" },
      { key: "is_organic",    label: "Organic",        type: "toggle" },
      { key: "package_size",  label: "Package size",   type: "text", placeholder: "e.g. 1 pack, 6 cans" },
    ],
  },
  {
    id: 2, name: "Rice Shop", image: null, status: "active",
    attribute_schema: [
      { key: "rice_type",     label: "Rice type",      type: "select", options: ["Sona Masuri", "Ponni", "Basmati", "Idli Rice", "Brown Rice"], required: true },
      { key: "weight",        label: "Weight",         type: "number", unit: "kg", required: true },
      { key: "bag_size",      label: "Bag size",       type: "text" },
      { key: "premium_grade", label: "Premium grade",  type: "toggle" },
      { key: "origin_state",  label: "Origin state",   type: "text", placeholder: "Tamil Nadu" },
    ],
  },
  {
    id: 3, name: "Pharmacy", image: null, status: "active",
    attribute_schema: [
      { key: "medicine_type",         label: "Medicine type",         type: "text", required: true },
      { key: "prescription_required", label: "Prescription required", type: "toggle" },
      { key: "manufacturer",          label: "Manufacturer",          type: "text" },
      { key: "expiry_date",           label: "Expiry date",           type: "date", required: true },
      { key: "dosage",                label: "Dosage",                type: "text", placeholder: "1 tablet twice a day" },
      { key: "batch_number",          label: "Batch number",          type: "text" },
    ],
  },
  {
    id: 4, name: "Electronics", image: null, status: "active",
    attribute_schema: [
      { key: "brand",            label: "Brand",            type: "text",     required: true },
      { key: "model_number",     label: "Model number",     type: "text" },
      { key: "warranty",         label: "Warranty",         type: "text",     placeholder: "1 year" },
      { key: "specifications",   label: "Specifications",   type: "textarea" },
      { key: "color",            label: "Color",            type: "text" },
      { key: "ram_storage",      label: "RAM / Storage",    type: "text",     placeholder: "8GB / 256GB" },
      { key: "battery_capacity", label: "Battery",          type: "number",   unit: "mAh" },
    ],
  },
  {
    id: 5, name: "Restaurant", image: null, status: "active",
    attribute_schema: [
      { key: "food_type",        label: "Food type",        type: "select", options: ["Veg", "Non-Veg", "Egg"], required: true },
      { key: "preparation_time", label: "Preparation time", type: "number", unit: "min" },
      { key: "ingredients",      label: "Ingredients",      type: "textarea" },
      { key: "spice_level",      label: "Spice level",      type: "select", options: ["Mild", "Medium", "Spicy", "Extra Spicy"] },
      { key: "addons",           label: "Add-ons",          type: "textarea", placeholder: "Raita, Pickle, ..." },
      { key: "portion_size",     label: "Portion size",     type: "text",   placeholder: "Half, Full, Family" },
    ],
  },
];

export type VType = { name: string; options: string[] };
// Per-axis-per-option image lists: { Color: { Black: [img1, img2], Blue: [...] } }
export type VariantImages = Record<string, Record<string, string[]>>;
export type ProductCombo = {
  id?: number;
  name: string;
  sku: string | null;
  options: Record<string, string>;
  price: number;
  stock: number;
  image?: string | null;
  status?: "active" | "inactive";
};
export type VendorProduct = {
  id: number; name: string; price: number; stock: number;
  category_id?: number | null;
  category_name: string;
  category_parent_id?: number | null;
  vendor_category_id: number;
  status: "active" | "inactive";
  has_variants: boolean;
  description?: string;
  offer_price?: number;
  sku?: string;
  delivery_time?: string;
  image?: string | null;
  attributes?: ProductAttributes;
  variant_types?: VType[];
  variants?: ProductCombo[];
  variant_images?: VariantImages;
  // Comprehensive catalog columns (returned by the API; edited in the manual form).
  mrp?: number | null;
  code?: string | null;
  barcode?: string | null;
  brand?: string | null;
  hsn_code?: string | null;
  tax_type?: string | null;
  tax_percentage?: number | null;
  discount_type?: string | null;
  discount_value?: number | null;
  min_stock_alert?: number | null;
  max_order_qty?: number | null;
  weight?: number | null;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  unit?: string | null;
  delivery_charge?: number | null;
  return_days?: number | null;
  warranty_days?: number | null;
  short_description?: string | null;
  tags?: string | null;
  gallery_images?: string | null;
  featured?: number | string | boolean | null;
};
const vendorProducts: VendorProduct[] = [
  { id: 1, name: "Sona Masuri Rice 5kg",      price: 380, stock: 24, category_name: "Rice Shop",   vendor_category_id: 2, status: "active", has_variants: true,
    attributes: { rice_type: "Sona Masuri", weight: 5, bag_size: "Jute 5kg", premium_grade: true, origin_state: "Tamil Nadu" } },
  { id: 2, name: "Cold-pressed Coconut Oil 1L",  price: 450, stock: 12, category_name: "Grocery",   vendor_category_id: 1, status: "active", has_variants: false,
    attributes: { weight: 1, brand: "Annapurna", expiry_date: "2027-05-01", is_organic: true, package_size: "1L bottle" } },
  { id: 5, name: "Smart LED Bulb 9W",         price: 699, stock: 8,  category_name: "Electronics", vendor_category_id: 4, status: "active", has_variants: false,
    attributes: { brand: "Philips", model_number: "B22 9W", warranty: "2 years", color: "Warm White" } },
];

// ----- Tokens (distribute / requests) ---------------------------------------

export type TokenDistRow = {
  id: number; from_name: string; to_name: string; tokens: number; amount: number; created_at: string; notes?: string;
};
const tokenIssued: TokenDistRow[] = [
  { id: 71, from_name: "Me",           to_name: "Comfort Wear",     tokens: 1000, amount: 1000, created_at: "2026-05-13 10:11" },
  { id: 70, from_name: "Me",           to_name: "Annapurna Stores", tokens: 1500, amount: 1500, created_at: "2026-05-12 18:42" },
];
const tokenReceived: TokenDistRow[] = [
  { id: 60, from_name: "District",     to_name: "Me",               tokens: 5000, amount: 5000, created_at: "2026-05-10 09:30" },
];

export type TokenRequest = {
  id: number; requester_name: string; tokens: number; amount: number; status: "pending"|"approved"|"rejected"|"cancelled"; created_at: string; notes?: string;
};
const tokenRequests: TokenRequest[] = [
  { id: 22, requester_name: "Bright Electronics", tokens: 2000, amount: 2000, status: "pending",  created_at: "2026-05-13 12:00" },
  { id: 21, requester_name: "HomeKart",           tokens: 1000, amount: 1000, status: "approved", created_at: "2026-05-12 09:14" },
];

// ----- Geo --------------------------------------------------------------------

export type GeoRow = { id: number; name: string; status: "active"|"inactive"; parent_name?: string };
const states:    GeoRow[] = [{ id: 1, name: "Tamil Nadu", status: "active" }];
const districts: GeoRow[] = [{ id: 1, name: "Coimbatore",  status: "active", parent_name: "Tamil Nadu" }];
const taluks:    GeoRow[] = [{ id: 1, name: "Coimbatore South", status: "active", parent_name: "Coimbatore" }, { id: 2, name: "Coimbatore North", status: "active", parent_name: "Coimbatore" }];
const pincodes:  GeoRow[] = [
  { id:  1, name: "641001", status: "active",   parent_name: "Coimbatore South" },
  { id:  2, name: "641002", status: "active",   parent_name: "Coimbatore South" },
  { id:  3, name: "641003", status: "active",   parent_name: "Coimbatore South" },
  { id:  4, name: "641004", status: "inactive", parent_name: "Coimbatore South" },
  { id:  5, name: "641011", status: "active",   parent_name: "Coimbatore North" },
  { id:  6, name: "641012", status: "active",   parent_name: "Coimbatore North" },
  { id:  7, name: "641013", status: "inactive", parent_name: "Coimbatore North" },
  { id:  8, name: "641014", status: "active",   parent_name: "Coimbatore North" },
  { id:  9, name: "641020", status: "active",   parent_name: "Coimbatore South" },
  { id: 10, name: "641021", status: "active",   parent_name: "Coimbatore South" },
  { id: 11, name: "641022", status: "active",   parent_name: "Coimbatore North" },
  { id: 12, name: "641023", status: "inactive", parent_name: "Coimbatore North" },
];

// ----- Vendors / Customers (admin / taluk view) -----------------------------

export type ManagedVendor = { id: number; name: string; mobile: string; shop_name: string; taluk: string; status: "active"|"inactive"|"blocked" };
const managedVendors: ManagedVendor[] = [
  { id: 10, name: "Annapurna Stores",   mobile: "9999000010", shop_name: "Annapurna Stores",   taluk: "Coimbatore South", status: "active" },
  { id: 11, name: "Spice Bazaar",       mobile: "9999000011", shop_name: "Spice Bazaar",       taluk: "Coimbatore South", status: "active" },
  { id: 12, name: "Comfort Wear",       mobile: "9999000012", shop_name: "Comfort Wear",       taluk: "Coimbatore South", status: "active" },
];

export type ManagedCustomer = {
  id: number; name: string; mobile: string; email: string; pincode: string;
  wallet_balance: number; status: "active"|"inactive"; created_at: string;
  referrer_name?: string | null; referrer_mobile?: string | null;
};
const managedCustomers: ManagedCustomer[] = [
  { id: 100, name: "Asha M.",    mobile: "9876543210", email: "asha@example.com",    pincode: "641001", wallet_balance: 320,  status: "active", created_at: "2026-01-12 10:00:00", referrer_name: "Karthik R.", referrer_mobile: "9876543212" },
  { id: 101, name: "Karthik R.", mobile: "9876543212", email: "karthik@example.com", pincode: "641002", wallet_balance: 1240, status: "active", created_at: "2026-01-05 09:30:00", referrer_name: null, referrer_mobile: null },
];

// ----- Payments / Withdrawals (admin) ---------------------------------------

export type ManualPayment = {
  id: number; user_name: string; user_mobile: string; amount: number;
  txn_id: string; screenshot_path: string | null; status: "pending"|"approved"|"rejected";
  created_at: string;
};
const manualPayments: ManualPayment[] = [
  { id: 21, user_name: "Asha M.",   user_mobile: "9876543210", amount: 1000, txn_id: "UPIabcd1234", screenshot_path: null, status: "pending",  created_at: "2026-05-13 14:21" },
  { id: 20, user_name: "Vimal P.", user_mobile: "9876543299", amount: 500,  txn_id: "GPay7788",    screenshot_path: null, status: "approved", created_at: "2026-05-12 10:05" },
];

export type AdminWithdrawal = { id: number; user_name: string; mobile: string; amount: number; method: "bank"|"upi"; status: "pending"|"approved"|"rejected"; created_at: string };
const adminWithdrawals: AdminWithdrawal[] = [
  { id: 8, user_name: "Karthik R.", mobile: "9876543212", amount: 1200, method: "upi",  status: "pending",  created_at: "2026-05-13 09:00" },
  { id: 7, user_name: "Asha M.",     mobile: "9876543210", amount: 500,  method: "bank", status: "approved", created_at: "2026-05-11 16:21" },
];

// ----- Drivers ---------------------------------------------------------------

export type Driver = { id: number; name: string; mobile: string; vehicle: string; license: string; salary: number; taluk: string; status: "active"|"inactive" };
const drivers: Driver[] = [
  { id: 200, name: "Ravi K.",  mobile: "9999000020", vehicle: "TN-37 AB 1234", license: "DL12345", salary: 18000, taluk: "Coimbatore South", status: "active" },
  { id: 201, name: "Suresh M.",mobile: "9999000021", vehicle: "TN-37 BC 4321", license: "DL54321", salary: 18000, taluk: "Coimbatore North", status: "active" },
];

// ----- Delivery rate tables (per-geography slabs/tiers) ---------------------

export type DeliveryKmSlab = {
  id: number;
  from_km: number;
  to_km: number;
  state: string;
  district: string;
  taluk: string;
  price_per_km: number;
};

const deliveryKmSlabs: DeliveryKmSlab[] = [
  { id: 1, from_km:  0, to_km:  3, state: "Tamil Nadu", district: "Coimbatore", taluk: "Coimbatore South",  price_per_km: 5  },
  { id: 2, from_km:  3, to_km: 10, state: "Tamil Nadu", district: "Coimbatore", taluk: "Coimbatore South",  price_per_km: 4  },
  { id: 3, from_km: 10, to_km: 25, state: "Tamil Nadu", district: "Coimbatore", taluk: "Coimbatore South",  price_per_km: 3  },
  { id: 4, from_km:  0, to_km:  5, state: "Tamil Nadu", district: "Coimbatore", taluk: "Coimbatore North",  price_per_km: 6  },
];

export type DeliveryTimeRate = {
  id: number;
  time_min: number;
  state: string;
  district: string;
  taluk: string;
  price: number;
};

const deliveryTimeRates: DeliveryTimeRate[] = [
  { id: 1, time_min: 30, state: "Tamil Nadu", district: "Coimbatore", taluk: "Coimbatore South",  price: 30 },
  { id: 2, time_min: 60, state: "Tamil Nadu", district: "Coimbatore", taluk: "Coimbatore South",  price: 55 },
  { id: 3, time_min: 30, state: "Tamil Nadu", district: "Coimbatore", taluk: "Coimbatore North",  price: 35 },
];

// ----- System pools ---------------------------------------------------------

export type SystemPool = { pool_key: string; balance: number };
const systemPools: SystemPool[] = [
  { pool_key: "admin_wallet", balance: -345.50 }, // negative just illustrates: bonuses paid out
];

export type SystemSetting = { setting_key: string; value: string };
const systemSettings: SystemSetting[] = [
  { setting_key: "token.low_threshold",       value: "50" },
  { setting_key: "welcome.bonus_amount",      value: "15" },
  { setting_key: "welcome.bonus_active",      value: "1" },
  { setting_key: "mlm.level_1_pct",           value: "25" },
  { setting_key: "mlm.level_2_pct",           value: "10" },
  { setting_key: "mlm.level_3_pct",           value: "1.5" },
  { setting_key: "buyback.slot_1_pct",        value: "15" },
  { setting_key: "buyback.slot_2_pct",        value: "10" },
  { setting_key: "buyback.slot_3_pct",        value: "5" },
  { setting_key: "buyback.slot_4_pct",        value: "2.5" },
  { setting_key: "commission.lucky_draw_pct", value: "3" },
  { setting_key: "commission.token_share_pct", value: "3.5" },
  { setting_key: "token.bonus.state",         value: "3.5" },
  { setting_key: "token.bonus.district",      value: "3" },
  { setting_key: "token.bonus.taluk",         value: "2" },
];

// ----- Driver-side orders ---------------------------------------------------

export type DriverOrder = {
  id: number; status: "assigned"|"picked_up"|"delivered"; pickup_address: string;
  drop_address: string; customer_name: string; customer_mobile: string;
  total: number; cod_amount: number;
};
const driverOrders: DriverOrder[] = [
  { id: 1062, status: "assigned",  pickup_address: "Bright Electronics, RS Puram", drop_address: "Asha M., 641001", customer_name: "Asha M.", customer_mobile: "9876543210", total: 1149, cod_amount: 0 },
  { id: 1051, status: "picked_up", pickup_address: "HomeKart, Saibaba Colony",     drop_address: "Karthik R., 641002", customer_name: "Karthik R.", customer_mobile: "9876543212", total: 320, cod_amount: 0 },
];

// ----- Public surface --------------------------------------------------------

export const mock = {
  async stats(role: string): Promise<StaffStats> { await delay(); return statsByRole[role] || {}; },

  async vendorOrders(): Promise<VendorOrder[]>     { await delay(); return [...vendorOrders]; },
  async vendorProducts(): Promise<VendorProduct[]> { await delay(); return [...vendorProducts]; },
  async vendorCategoriesFull(): Promise<VendorCategoryFull[]> { await delay(); return JSON.parse(JSON.stringify(vendorCategoriesFull)); },
  async currentVendorCategory(): Promise<VendorCategoryFull | null> {
    await delay();
    // Logged-in vendor's category (mock; backend will return based on auth)
    return JSON.parse(JSON.stringify(vendorCategoriesFull.find((c) => c.id === 1) ?? null));
  },

  async tokenIssued(): Promise<TokenDistRow[]>     { await delay(); return [...tokenIssued]; },
  async tokenReceived(): Promise<TokenDistRow[]>   { await delay(); return [...tokenReceived]; },
  async tokenRequests(): Promise<TokenRequest[]>   { await delay(); return [...tokenRequests]; },

  async states(): Promise<GeoRow[]>    { await delay(); return [...states]; },
  async districts(): Promise<GeoRow[]> { await delay(); return [...districts]; },
  async taluks(): Promise<GeoRow[]>    { await delay(); return [...taluks]; },
  async pincodes(): Promise<GeoRow[]>  { await delay(); return [...pincodes]; },

  async vendors(): Promise<ManagedVendor[]>     { await delay(); return [...managedVendors]; },
  async customers(): Promise<ManagedCustomer[]> { await delay(); return [...managedCustomers]; },

  async manualPayments(): Promise<ManualPayment[]>   { await delay(); return [...manualPayments]; },
  async adminWithdrawals(): Promise<AdminWithdrawal[]>{ await delay(); return [...adminWithdrawals]; },

  async drivers(): Promise<Driver[]>           { await delay(); return [...drivers]; },
  async driverOrders(): Promise<DriverOrder[]> { await delay(); return [...driverOrders]; },

  async deliveryKmSlabs(): Promise<DeliveryKmSlab[]>       { await delay(); return [...deliveryKmSlabs]; },
  async deliveryTimeRates(): Promise<DeliveryTimeRate[]>   { await delay(); return [...deliveryTimeRates]; },

  async systemPools(): Promise<SystemPool[]>       { await delay(); return [...systemPools]; },
  async systemSettings(): Promise<SystemSetting[]> { await delay(); return [...systemSettings]; },
};
