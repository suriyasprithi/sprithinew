import { api } from "./api";

export type AdminDashboard = {
  totals: {
    customers: number;
    vendors: number;
    todays_orders: number;
    todays_revenue: number;
    pending_payments: number;
    pending_withdrawals: number;
  };
  orders_series: { date: string; orders: number; revenue: number }[];
  top_categories: { id: number; name: string; revenue: number; orders: number }[];
  recent_orders: {
    id: number;
    customer: string;
    vendor: string;
    total: number;
    status: string;
    created_at: string;
  }[];
  latest_vendors: {
    id: number;
    name: string;
    category: string | null;
    image: string | null;
    status: string;
    created_at: string;
  }[];
};

export async function getAdminDashboard(): Promise<AdminDashboard> {
  const res = await api.get<{ data: AdminDashboard }>("/admin/stats/dashboard");
  return res.data.data;
}

export type VendorDashboard = {
  totals: {
    todays_orders: number;
    active_products: number;
    token_balance: number;
    wallet: number;
  };
  orders_series: { date: string; orders: number; revenue: number }[];
  recent_orders: {
    id: number;
    customer: string;
    items: number;
    total: number;
    status: string;
    created_at: string;
  }[];
};

export async function getVendorDashboard(): Promise<VendorDashboard> {
  const res = await api.get<{ data: VendorDashboard }>("/vendor/stats/dashboard");
  return res.data.data;
}

export type StaffDashboard = {
  role: "taluk" | "district" | "state";
  totals: {
    tokens_issued: number;
    tokens_received: number;
    token_balance: number;
    wallet: number;
    team_below: number;
  };
  series: { date: string; count: number; value: number }[];
  top: { id: number; name: string; mobile: string | null }[];
};

export async function getStaffDashboard(): Promise<StaffDashboard> {
  const res = await api.get<{ data: StaffDashboard }>("/staff/stats/dashboard");
  return res.data.data;
}

export type DriverDashboard = {
  totals: {
    pending_deliveries: number;
    delivered_today: number;
    total_delivered: number;
    monthly_salary: number;
  };
  orders_series: { date: string; orders: number }[];
  recent_orders: {
    id: number;
    customer: string;
    total: number;
    status: string;
    created_at: string;
  }[];
};

export async function getDriverDashboard(): Promise<DriverDashboard> {
  const res = await api.get<{ data: DriverDashboard }>("/driver/stats/dashboard");
  return res.data.data;
}
