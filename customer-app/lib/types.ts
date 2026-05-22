export type CustomerProfile = {
  user_id: number | string | null;
  address: string | null;
  photo: string | null;
  aadhar: string | null;
  pan: string | null;
  bank_name: string | null;
  account_number: string | null;
  ifsc_code: string | null;
  gpay: string | null;
  phonepe: string | null;
  paytm: string | null;
  upi: string | null;
  payment_link: string | null;
};

export type ProfileBundle = {
  user: {
    id: number;
    name: string;
    email: string | null;
    mobile_number: string;
    role: string;
    status: string;
    wallet_balance: number;
  };
  profile: CustomerProfile;
};
