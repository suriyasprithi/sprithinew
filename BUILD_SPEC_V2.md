# Epey V2 — Build Spec

**Generated:** 2026-05-13  
**Scope:** Complete rebuild of Epey on a **fresh database**. Existing backend code is referenced for stack/wiring; old DB schema is **discarded**. App (Android + iOS via Capacitor) is built **alongside** the backend.

> Core requirement (from CLAUDE.md): push notifications must work inside the APK.

---

## 0. Tech stack (locked)

| Layer | Stack |
|---|---|
| Backend API | **PHP 8 + CodeIgniter 4** (existing `backend/`), MySQL, custom JWT |
| Customer app | **Next.js 16 + React 19 (TypeScript)** → static export → **Capacitor 8** → Android + iOS APK |
| Staff app | Same Next.js+Capacitor stack (`staff-app/`) |
| Driver UI | A new section in `staff-app` OR a third tiny Capacitor app (decide in Phase 6) |
| Push | **Firebase Cloud Messaging** via existing `FirebaseService` + `@capacitor/push-notifications` |
| State (frontend) | Zustand (already there) |
| Forms | React Hook Form + Zod |

**Fresh database. No data migration from existing tables.**

---

## 1. Roles & hierarchy

```
Admin
 ├── State        (created by admin)
 ├── District     (created by admin)        ←——————╮
 ├── Driver       (created by admin)               │
 │                                                 │
 └── Customer (self-register w/ optional referrer) │
                                                   │
District ──► Taluk         (created by district)   │
Taluk    ──► Vendor        (created by taluk)      │
```

**Login-allowed roles:** `customer, vendor, taluk, district, state, driver, admin`.  
**Removed:** `vmanager`, `vendor-staff`-as-login.

Each role has password-based login only (no OTP in V2).

---

## 2. Wallets (7 per user, MySQL DECIMAL(12,2))

| Column | Source of credits | Transferable to `wallet_balance`? | Withdrawable? |
|---|---|---|---|
| `wallet_balance` | Vendor sales (X−pool), wallet send received, manual deposit approved | n/a | ✅ via `/withdrawals` |
| `level_wallet` | Welcome bonus (referrer) | ✅ free | via `wallet_balance` |
| `level_1_wallet` | L1 MLM commission (25% of pool) | ❌ gated — 100 direct referrals threshold | via `wallet_balance` |
| `level_2_wallet` | L2 MLM commission (10%) | ❌ gated — 10,000 referrals | via `wallet_balance` |
| `level_3_wallet` | L3 MLM commission (1.5%) | ❌ gated — 100,000 referrals | via `wallet_balance` |
| `buyback_wallet` | Buyback FIFO queue payouts (15/10/5/2.5% slots) | ✅ free | via `wallet_balance` |
| `global_wallet` | Buyer's 2.5% (if no new referral in 90 days) | ✅ free | via `wallet_balance` |

**`level_1/2/3_wallet` unlock mechanic:**  
Each direct referral past the threshold unlocks ONE transfer event whose amount equals the L1 commission earned from that specific new referral's first purchase. Tracked in `level_transfer_unlocks(beneficiary_id, source_user_id, level, amount, used)`.

---

## 3. Welcome bonus

- ₹15 → **referrer's `level_wallet`** when a new customer signs up with a valid `referrer_code` (= referrer's mobile_number).
- **Not** debited from `admin_wallet` (decision 2026-05-13). The bonus is system-credited; admin sees aggregate count + total via `SELECT COUNT(*), SUM(amount) FROM wallet_transactions WHERE type='welcome_bonus'`.
- Logged in `wallet_transactions(type='welcome_bonus', amount=<settings value>)`.
- Amount + on/off read live from `system_settings` (`welcome.bonus_amount`, `welcome.bonus_active`) per signup.
- No bonus for unreferred signups.

---

## 4. Categories (two separate concerns)

### 4a. `vendor_categories` — drives product form schema
- Admin CRUD.
- Columns: `id, name, attribute_schema JSON, status, timestamps`.
- `attribute_schema` is a JSON array of field defs, e.g.:
  ```json
  [
    { "key": "weight", "label": "Weight (kg)", "type": "number", "required": true },
    { "key": "expiry", "label": "Expiry date", "type": "date" }
  ]
  ```
- Vendor link: `vendor_profiles.vendor_category_id`.
- Frontend renders the product add/edit form dynamically from this schema.

### 4b. `categories` (product categories) — drives commission %
- Admin CRUD (already exists in scope).
- Add column: `commission_pct DECIMAL(5,2) DEFAULT 0` (e.g., 3.00, 4.00).
- A product references this via `products.category_id`.
- If `commission_pct = 0`, no commission cascade fires (vendor keeps full amount, no token deduction).

---

## 5. Commission model

### Pool calculation
For each line item:
```
pool = item.price × item.qty × product.category.commission_pct / 100
```
Total order pool = sum of line pools.

### Split (totals 100% of pool)

| Recipient | % of pool | Target wallet |
|---|---|---|
| L1 upline of buyer | 25% | `level_1_wallet` |
| L2 upline of buyer | 10% | `level_2_wallet` |
| L3 upline of buyer | 1.5% | `level_3_wallet` |
| Buyback — paid to next 4 distinct customers | 15% / 10% / 5% / 2.5% | each future buyer's `buyback_wallet` |
| Buyer (if NOT referred anyone in last 90 days) | 2.5% | buyer's `global_wallet` |
| Vendor's area Taluk | 2% | `wallet_balance` |
| Vendor's area District | 1% | `wallet_balance` |
| Vendor's area State | 1% | `wallet_balance` |
| Remainder + forfeited global | 24.5% (+ 2.5%) | `admin_wallet` (system_pools row) |

### Vendor settlement
```
vendor.wallet_balance += order_total − pool
admin_wallet          += unallocated_remainder + forfeited_global
```

### Worked example
Customer A buys ₹100 from a grocery vendor; product's category has `commission_pct = 3%`. Pool = ₹3.

- A's L1 upline (referrer): +₹0.75 to `level_1_wallet`
- A's L2 upline: +₹0.30 to `level_2_wallet`
- A's L3 upline: +₹0.045 to `level_3_wallet`
- A himself: +₹0.075 to `global_wallet` (if A hasn't referred anyone in 90 days, else this ₹0.075 → admin_wallet)
- Taluk of vendor: +₹0.06 to `wallet_balance`
- District: +₹0.03
- State: +₹0.03
- Buyback ₹0.975 reserved in `buyback_queue` for next 4 distinct customers
- Admin: +₹0.735 to `admin_wallet`
- Vendor: +₹97.00 to `wallet_balance`
- A: −₹100 from `wallet_balance` (plus delivery fee separately)
- Vendor `token_balance`: −3 tokens

---

## 6. Buyback chain (FIFO queue — NOT MLM)

**Concept:** Customer A buys. The next 4 distinct customers (anywhere in India, any time later) get a slice of A's buyback pool — 15% / 10% / 5% / 2.5% in chronological order.

**Schema:**
```
buyback_queue (
  id BIGINT PK,
  purchase_order_id BIGINT,
  beneficiary_id BIGINT  -- the original buyer (A)
  pool_amount DECIMAL(12,2),
  slots_filled TINYINT DEFAULT 0,
  created_at DATETIME
)
INDEX (beneficiary_id, slots_filled, created_at DESC)
```

**Algorithm on new purchase by buyer X:**
1. `SELECT * FROM buyback_queue WHERE beneficiary_id != X AND slots_filled < 4 ORDER BY created_at DESC LIMIT 4`.
2. For each found row, slot = slots_filled + 1:
   - slot 1 → X.buyback_wallet += 15% × pool_amount
   - slot 2 → X.buyback_wallet += 10% × pool_amount
   - slot 3 → X.buyback_wallet += 5% × pool_amount
   - slot 4 → X.buyback_wallet += 2.5% × pool_amount
3. Increment slots_filled on each row.
4. INSERT new row for X's purchase, slots_filled=0.

**Edge cases:**
- First few customers in the system have fewer than 4 prior unexhausted rows → smaller buyback (acceptable).
- A customer doesn't earn buyback from their own purchases (the `beneficiary_id != X` filter).
- After 4 slots filled, a row is exhausted and never pays out again.

---

## 7. Token flow

### Schema
```
distribute_tokens (id, from_user_id, to_user_id, tokens INT, amount DECIMAL, notes, created_at)
token_requests   (id, requester_id, target_user_id, tokens, amount, status ENUM(pending,approved,rejected,cancelled), processed_by, notes, timestamps)
```
+ `users.token_balance INT NOT NULL DEFAULT 0`.

### Distribute (push down)
- Allowed roles: `state, district, taluk, admin`.
- On `POST /tokens/distribute`:
  - Insert primary `distribute_tokens` row from caller → target.
  - Increment target's `token_balance`.
  - Markup credits to upper tiers (cumulative): taluk earns 2%, district 1%, state 1% of the tokens passing through this transaction.
  - Push notification to target.

### Markup math
Example: vendor receives 1000 tokens.
- Vendor `token_balance` += 1000.
- Vendor's taluk earns 2% of 1000 = +20 to taluk's `token_balance` (or `wallet_balance` — see Q below).
- Vendor's district earns 1% of (1000 + 20) = +10.20.
- Vendor's state earns 1% of (1000 + 30.20) ≈ +10.30.
- Total tokens spawned: 1040.50.

*Question for user:* the markup goes to the upper tier as **tokens** (their token_balance) or as **wallet credit** (rupees)? Spec defaults to tokens; flag in Phase 5 implementation if a different intent.

### Request (pull up)
- Allowed roles: `vendor, taluk, district, state`.
- Standard pending → admin processes → approved auto-issues a distribute row (with the same markup cascade above).

### Token reduction on purchase
- On every successful purchase, vendor's `token_balance` -= total pool tokens (one token per rupee of pool).
- Block the order if `token_balance < pool` and `system_settings('token.allow_negative_balance') = '0'`.
- Otherwise allow the order through (balance goes negative).
- After decrement, if `token_balance < system_settings('token.low_threshold')` (default 50) and crossing threshold this txn, push "low balance" alert to the vendor.

---

## 8. Driver flow

### Schema
```
driver_profiles (
  user_id BIGINT PK,
  taluk_id BIGINT,
  vehicle VARCHAR,
  license VARCHAR,
  salary_monthly DECIMAL(10,2),
  status ENUM('active','inactive'),
  last_assigned_at DATETIME NULL
)

driver_collections (
  id BIGINT PK,
  driver_id BIGINT, order_id BIGINT, amount DECIMAL,
  status ENUM('pending','handed','deducted'),
  collected_at DATETIME, settled_at DATETIME NULL
)

delivery_assignments (
  id BIGINT PK,
  order_id BIGINT UNIQUE, driver_id BIGINT,
  status ENUM('assigned','picked_up','delivered'),
  km DECIMAL(8,2) DEFAULT 0,
  hours DECIMAL(6,2) DEFAULT 0,
  charge DECIMAL(10,2) DEFAULT 0,
  assigned_at, completed_at
)
```

Add to `orders`: `delivery_fee DECIMAL(10,2) DEFAULT 0`, `driver_id BIGINT NULL`.

### Delivery fee
- Admin sets system_settings: `delivery.base_fee`, `delivery.rate_per_km`, `delivery.rate_per_hour`.
- Fee = `base_fee + km × rate_per_km + hours × rate_per_hour`.
- Customer pays `order_total + delivery_fee` from `wallet_balance` at checkout.
- Delivery fee held in `admin_wallet` until reconciliation.

### Assignment
- On `/orders/place`, auto-pick a driver where `driver_profiles.taluk_id == vendor.taluk_id, status='active'` ORDER BY `last_assigned_at ASC` LIMIT 1.
- Update `driver_profiles.last_assigned_at`. Insert `delivery_assignments` row.
- Push notification to driver.

### Driver workflow
- `GET /driver/orders` — list assigned orders.
- `PATCH /driver/orders/{id}/pickup` — mark picked_up.
- `PATCH /driver/orders/{id}/deliver` — record km, hours; mark delivered.
- `POST /driver/orders/{id}/collected` — driver flags cash collected from customer (for COD-style edge case).

### Salary + COD reconciliation
- `POST /admin/drivers/{id}/pay-salary`:
  - Sum `driver_collections WHERE driver_id=id AND status='pending'`.
  - Pay = `salary_monthly − pending_collection_sum`.
  - Mark those collection rows `status='deducted'`.
  - (No wallet transaction — driver has no wallet. Salary tracked in an audit log table `driver_salary_payouts`.)

---

## 9. Order flow (end-to-end)

```
Customer cart  →  POST /orders/place
                     │
   1. Validate cart items + variants + stock
   2. Compute order_total + per-line commission pool
   3. Check vendor.token_balance >= total_pool (else reject unless allow_negative)
   4. Check customer.wallet_balance >= order_total + delivery_fee (else reject)
   5. Insert orders row (status='paid')
   6. Insert order_items rows; decrement variant stock
   7. Debit customer.wallet_balance
   8. Credit vendor.wallet_balance += order_total - pool
   9. Decrement vendor.token_balance -= total_pool
  10. CommissionService::distributeForOrder
        - L1/L2/L3 credits (level_1/2/3_wallet)
        - Buyback queue: pay X from prior 4 rows, insert new row
        - Global: buyer's global_wallet if eligible, else admin_wallet
        - Taluk/District/State wallet_balance credits
        - Admin remainder to admin_wallet
        - level_transfer_unlocks rows when applicable
        - Notify each beneficiary
  11. Auto-assign driver (taluk match)
  12. Hold delivery_fee in admin_wallet
  13. Push notifications: customer, vendor, admin, driver
  14. Clear cart
```

No cancellation. No refund. Status flow: `pending` → `paid` (immediate on place) → `shipped` → `delivered`. Vendor PATCHes status; admin/driver can also update.

### Multi-vendor cart
- If cart has items from >1 vendor → **split into one order per vendor** on `/orders/place` (each gets its own driver assignment, commission, token deduction).

### QR purchase (`/purchase/qr`)
- Customer scans vendor mobile, enters amount + (optional) category_id.
- Same wallet/commission/token logic. Synthetic order row with notes='QR'.
- No delivery (in-store), no driver assignment.

---

## 10. Out of scope (do NOT build)

- ❌ Razorpay or any payment gateway. Wallet top-up = customer uploads transfer-proof screenshot; admin approves; admin manually credits.
- ❌ Refunds (no reverse-commission, no token refund).
- ❌ Order cancellation.
- ❌ OTP login or signup.
- ❌ vmanager role.
- ❌ monthly_wallet.
- ❌ Subscriptions, lucky draw, wishlist, support tickets, vendor-staff HR — all dropped from V2 (re-introduce later if requested).

---

## 11. Database — full migration list (fresh)

Run in this order. All in `backend/app/Database/Migrations/`.

| # | Filename | Tables/Columns |
|---|---|---|
| 01 | `CreateUsersTable` | `users(id, name, email NULL, mobile_number, password_hash, role ENUM, status, pincode NULL, referrer_id NULL FK, level_1_count, level_2_count, level_3_count, wallet_balance, level_wallet, level_1_wallet, level_2_wallet, level_3_wallet, buyback_wallet, global_wallet, token_balance INT, timestamps)`. UNIQUE(mobile_number, role). |
| 02 | `CreateGeoTables` | `states(id, name, status, ts)`, `districts(id, state_id FK, name, status, ts)`, `taluks(id, district_id FK, name, status, ts)`, `pincodes(id, code, district_id FK, taluk_id FK, ts)`. |
| 03 | `CreateVendorCategoriesTable` | `vendor_categories(id, name, attribute_schema JSON, status, ts)`. |
| 04 | `CreateProductCategoriesTable` | `categories(id, name, commission_pct DECIMAL(5,2) DEFAULT 0, status, ts)`. |
| 05 | `CreateVendorProfilesTable` | `vendor_profiles(user_id PK FK, vendor_category_id FK NULL, shop_name, address, area, state_id FK NULL, district_id FK NULL, taluk_id FK NULL, gst NULL, ts)`. |
| 06 | `CreateDriverTables` | `driver_profiles(user_id PK FK, taluk_id FK, vehicle, license, salary_monthly, status, last_assigned_at NULL, ts)`, `driver_collections`, `delivery_assignments`, `driver_salary_payouts(id, driver_id, paid_amount, deducted_amount, period_from, period_to, paid_at)`. |
| 07 | `CreateProductsTable` | `products(id, vendor_id FK, category_id FK, name, description, price DECIMAL(12,2), stock INT, image NULL, attributes JSON NULL, status, ts)`. |
| 08 | `CreateProductVariantsTable` | `product_variants(id, product_id FK, name, price, stock INT, status, ts)`. |
| 09 | `CreateCartTable` | `cart_items(id, user_id FK, product_id FK, variation_id FK NULL, qty INT, ts)`. UNIQUE(user_id, product_id, variation_id). |
| 10 | `CreateOrdersTable` | `orders(id, customer_id FK, vendor_id FK NULL, total DECIMAL, delivery_fee DECIMAL DEFAULT 0, driver_id FK NULL, status ENUM('pending','paid','shipped','delivered'), notes, ts)`, `order_items(id, order_id, product_id, variation_id NULL, variation_label NULL, name, qty, price, subtotal)`. |
| 11 | `CreateWalletTransactionsTable` | `wallet_transactions(id, user_id FK, peer_user_id FK NULL, amount, type, reference, notes, created_at)`. |
| 12 | `CreatePaymentsTable` | `payments(id, user_id FK, amount, method ENUM('manual'), proof_url NULL, status ENUM('pending','approved','rejected'), processed_by NULL, notes, ts)`. (manual top-up only.) |
| 13 | `CreateWithdrawalsTable` | `withdrawals(id, user_id FK, amount, method, account_details JSON, status ENUM('pending','approved','rejected'), processed_by NULL, notes, ts)`. |
| 14 | `CreateReferralsTable` | `referrals(id, referrer_id FK, referred_id FK, first_purchase_at NULL, bonus_amount DECIMAL DEFAULT 0, ts)`. |
| 15 | `CreateLevelTransferUnlocksTable` | `level_transfer_unlocks(id, beneficiary_id FK, source_user_id FK, level TINYINT, amount, used BOOL DEFAULT 0, created_at, used_at NULL)`. |
| 16 | `CreateBuybackQueueTable` | `buyback_queue(id, purchase_order_id FK, beneficiary_id FK, pool_amount, slots_filled TINYINT DEFAULT 0, created_at)`. |
| 17 | `CreatePurchaseCommissionsTable` | `purchase_commissions(id, order_id FK, beneficiary_id FK, source_user_id FK NULL, bucket VARCHAR (level_1, level_2, level_3, buyback_slot_1..4, global, taluk, district, state, admin, vendor_net), percent DECIMAL(5,2), amount DECIMAL(12,2), created_at)`. (Single audit log for all 11 buckets.) |
| 18 | `CreateTokenTables` | `distribute_tokens(id, from_user_id FK, to_user_id FK, tokens INT, amount DECIMAL, kind ENUM('primary','markup'), markup_for_tx_id FK NULL, notes, created_at)`, `token_requests(...)`. |
| 19 | `CreateSystemPools` | `system_pools(key VARCHAR PK, balance DECIMAL DEFAULT 0)`. Seed: `('admin_wallet', 0)`. |
| 20 | `CreateSystemSettingsTable` | `system_settings(key PK, value, updated_at)`. Seed keys below. |
| 21 | `CreateNotificationsTable` | `notifications(id, user_id FK, type, title, body, entity_id NULL, route NULL, read_at NULL, created_at)`. |
| 22 | `CreateDeviceTokensTable` | `device_tokens(id, user_id FK, token VARCHAR(255), platform ENUM('android','ios','web'), created_at, updated_at)`. UNIQUE(token). |

### Seed `system_settings`
```
delivery.base_fee = 0
delivery.rate_per_km = 5
delivery.rate_per_hour = 30
token.low_threshold = 50
token.allow_negative_balance = 0
welcome.bonus_amount = 15
welcome.bonus_active = 1
referral.no_referral_days = 90        # global wallet rule
level.unlock_threshold_1 = 100
level.unlock_threshold_2 = 10000
level.unlock_threshold_3 = 100000
buyback.slot_1_pct = 15
buyback.slot_2_pct = 10
buyback.slot_3_pct = 5
buyback.slot_4_pct = 2.5
geo.taluk_pct = 2
geo.district_pct = 1
geo.state_pct = 1
mlm.level_1_pct = 25
mlm.level_2_pct = 10
mlm.level_3_pct = 1.5
mlm.global_pct = 2.5
token.markup_taluk_pct = 2
token.markup_district_pct = 1
token.markup_state_pct = 1
```

---

## 12. API endpoints (V2 surface)

### Auth (no auth required)
- `POST /api/v1/auth/register` — customer self-register (+ welcome bonus on referrer)
- `POST /api/v1/auth/login` — password login, role-aware

### Auth (authed)
- `GET  /auth/me`
- `POST /auth/logout`
- `POST /auth/refresh`

### Public (no auth, used by `shop-public` etc.)
- `GET /public/home`
- `GET /public/products?q=&category_id=&pincode=`
- `GET /public/products/{id}`
- `GET /public/vendors?pincode=`
- `GET /public/pincodes/{code}`

### Customer
- `GET /catalog/products` (auth, full filter)
- `GET /cart`, `POST /cart/add`, `PATCH /cart/{id}`, `DELETE /cart/{id}`, `DELETE /cart`
- `POST /orders/place`
- `GET /orders/mine`, `GET /orders/{id}`
- `POST /purchase/qr`
- `GET /wallet/balances`, `POST /wallet/send`, `POST /wallet/transfer`
- `POST /withdrawals`, `GET /withdrawals/mine`
- `POST /payments/manual` (upload screenshot to top up)
- `GET /payments/mine`
- `GET /referrals/info`, `GET /referrals/list`   ← **L1 visibility for customer**
- `GET /notifications`, `PATCH /notifications/{id}/read`
- `POST /devices/register`, `POST /devices/unregister`
- `GET /profile`, `PATCH /profile`

### Vendor
- `GET /vendor/products`, `POST /vendor/products`, `PATCH /vendor/products/{id}`, `DELETE /vendor/products/{id}`
- `POST /vendor/products/{id}/variants`, `PATCH /vendor/products/{id}/variants/{v}`, `DELETE`
- `GET /orders/list?status=` (vendor-scoped)
- `PATCH /orders/{id}/status`
- `GET /tokens/balance` (returns vendor's `token_balance`)
- `POST /tokens/requests`, `GET /tokens/requests/mine`, `PATCH /tokens/requests/{id}`, `POST /tokens/requests/{id}/cancel`
- `GET /staff/dashboard`

### Taluk
- `POST /taluk/vendors` — create vendor user + profile
- `GET /taluk/vendors` — list vendors in my taluk
- `POST /tokens/distribute`, `GET /tokens/distribute/history`
- `POST /tokens/requests`
- `GET /staff/dashboard`

### District
- `POST /district/taluks` — create taluk user
- `GET /district/taluks`
- `POST /tokens/distribute`, history, requests
- `GET /staff/dashboard`

### State
- `GET /state/districts` (list districts in my state)
- `POST /tokens/distribute`, history, requests
- `GET /staff/dashboard`

### Driver
- `GET /driver/orders`
- `PATCH /driver/orders/{id}/pickup`
- `PATCH /driver/orders/{id}/deliver` (km, hours)
- `POST /driver/orders/{id}/collected`

### Admin
- `POST /admin/states` (create state user)
- `POST /admin/districts` (create district user)
- `POST /admin/drivers` (create driver user + profile)
- Customer block/unblock
- `GET /admin/vendor-categories`, POST, PATCH, DELETE
- `GET /admin/categories`, POST, PATCH, DELETE
- `GET /admin/payments/pending`, approve/reject (manual top-ups)
- `GET /admin/withdrawals/pending`, approve/reject
- `GET /admin/token-requests`, process
- Geo CRUD (states, districts, taluks, pincodes)
- `GET /admin/settings`, `PATCH /admin/settings`
- `GET /admin/stats`
- `GET /admin/system-pools` (view admin_wallet balance + history)
- `POST /admin/drivers/{id}/pay-salary`
- `POST /notifications/send`
- CSV exports: customers, orders, payments, withdrawals

---

## 13. Frontend screens

### customer-app (`customer-app/`)
- Login, Register (with referrer_code field)
- Home (banners + featured products)
- Shop (public + authed)
- Product detail (renders dynamic attributes from `products.attributes` + `vendor_categories.attribute_schema`)
- Cart, Checkout (shows delivery_fee)
- Wallet (7 wallets visible; transfer UI gated for level_1/2/3)
- L1 referrals page (mobile numbers)
- Orders list + detail
- Profile
- Notifications inbox

### staff-app (`staff-app/`)
**Existing app — needs restructure.** Re-organize by role detected from `/auth/me`:
- **Admin** — vendor-categories CRUD, product-categories CRUD, geo CRUD, payment approvals, withdrawal approvals, token-request approvals, driver create + salary payout, system settings editor, stats dashboard, system pool viewer
- **State** — districts list, token distribute, token requests, dashboard
- **District** — taluks list + create, token distribute, dashboard
- **Taluk** — vendors list + create, token distribute, dashboard
- **Vendor** — products CRUD (dynamic form by vendor_category schema), orders list + status update, token balance + request form, dashboard

### Driver UI (decide in Phase 6)
- Either a new section in `staff-app` gated by role=driver, OR a third Capacitor app.
- Screens: today's assigned orders, order detail (customer name, address, vendor pickup), pickup button, deliver form (km + hours + collected flag).

---

## 14. Phase execution plan (parallel backend + frontend per phase)

Each phase = backend code + matching frontend screens + one round of manual testing in the APK or web preview.

### Phase 1 — Foundation
- Backend: migrations 01–02, 19–22 (users, geo, system pools, settings, notifications, device tokens)
- Frontend: login, register (with referrer_code), `/auth/me` plumbing already exists — verify only
- Verify: signup gives welcome bonus to referrer's level_wallet; admin_wallet debits

### Phase 2 — Categories + Products + Vendor onboarding
- Backend: migrations 03, 04, 05, 07, 08; `POST /admin/vendor-categories` CRUD; `POST /admin/categories` CRUD with commission_pct; taluk creates vendor endpoint; product CRUD
- Frontend: admin vendor-category editor (JSON schema textarea + form preview); vendor add-product dynamic form; public shop page renders products

### Phase 3 — Commission + Order + Buyback
- Backend: migrations 09, 10, 11, 14, 15, 16, 17; new `CommissionService`; new `OrderController::place`; new QR purchase
- Frontend: cart, checkout, orders list, order detail with status updates

### Phase 4 — Wallet rules + Transfer + Withdrawal + Manual payment
- Backend: migrations 12, 13; wallet transfer with gating; withdrawal create/approve; manual payment upload + admin approve
- Frontend: wallet screen (7 wallets), transfer modal, withdrawal form, manual top-up flow, admin approval list

### Phase 5 — Token flow with markup + reduction
- Backend: migration 18; token distribute with markup, requests, admin process, balance check in order flow, low-balance push
- Frontend: vendor token balance widget; taluk/district/state distribute UI; request form

### Phase 6 — Driver flow
- Backend: migration 06 (drivers + collections + assignments); driver controller endpoints; auto-assign on `/orders/place`; salary paycycle
- Frontend: admin driver create + salary form; driver UI screens (assigned orders, log km/hr)

### Phase 7 — Polish + dashboards + exports
- Backend: stats endpoint per role, CSV exports
- Frontend: each role dashboard, admin stats, CSV download buttons
- Push notifications integration end-to-end test on Android APK

### Phase 8 — APK build + deployment
- Customer-app: `npm run build`, `cap:sync`, `cap:run:android` test, signed APK build
- Staff-app: same
- Backend: deploy to a VPS (decide host), set up domain + HTTPS, point apps to production URL
- Firebase project keys configured for push

---

## 15. Working agreements (per CLAUDE.md)

- ✅ Discuss first, code second.
- ✅ Minimal functionality only; no extra features per phase.
- ✅ Each phase committable on its own.
- ✅ Push notifications must continue to work after every phase.

---

## 16. Open items (resolve as we go)

1. **Token markup target wallet**: do upper-tier markups (taluk 2%, district 1%, state 1%) credit their `token_balance` (default) or their `wallet_balance`? Currently in spec as token_balance — flag in Phase 5 if rupees instead.
2. **Manual payment top-up workflow**: customer uploads screenshot → admin sees in queue → admin enters amount + approves → customer's `wallet_balance` credited. Confirm proof image storage path.
3. **Deployment host**: which VPS/cloud will run the backend long-term?
4. **First admin/state/district seeding**: how do we bootstrap the first admin user since no one can create them via API? Plan: a `DatabaseSeeder` that inserts one `admin` (mobile 9999000001, password change-me) on first install.
5. **Withdrawal method**: bank transfer, UPI, or both? `account_details JSON` covers either.
