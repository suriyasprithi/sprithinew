# Phase 1 — Foundation: Plan (decisions locked, executing)

**Status:** decisions locked 2026-05-13. Implementing now.
**Source:** `BUILD_SPEC_V2.md` §14 Phase 1.

---

## Locked decisions

| # | Decision | Choice |
|---|---|---|
| D1 | Fresh-DB strategy | Parallel `epey_v2` database; old `epey` untouched. Cutover later by env var. |
| D2 | Old migrations + dropped-scope code | Delete now (in-session) |
| D3 | First admin seed | mobile `9999000001`, password `change-me` |
| D4-A | Welcome bonus when admin pool empty | **No admin_wallet debit at all.** Bonus always credits referrer. Each issue is logged to `wallet_transactions(type='welcome_bonus', amount=15)` so admin can see count + total of bonuses given. **This overrides BUILD_SPEC_V2.md §3 — that section will be patched.** |
| D4-B | Bonus amount + on/off | Live read from `system_settings` per signup |
| D5 | Phase 1 frontend scope | Strict backend only — register form already collects `referrer_code`, no UI work |

---

## What Phase 1 covers
- Backend migrations 01–02, 19–22 from spec §11.
- New `WelcomeBonusService` wired into `AuthController::register`.
- `DatabaseSeeder` with one admin user.
- Backend `.env` switched to `epey_v2`.
- Cleanup: delete dropped-scope migrations, controllers, models, services, and their `Routes.php` entries.

Phase 1 does NOT touch: products, cart, orders, commissions, tokens, drivers, withdrawals, staff-app role restructure.

---

## Execution order
1. Patch BUILD_SPEC_V2.md §3 to reflect D4-A (no admin debit).
2. Write 6 new migrations on the V2 schema.
3. Write/update 6 models.
4. Write `WelcomeBonusService` (live settings, no admin debit, log + push).
5. Wire it into `AuthController::register`.
6. Write `DatabaseSeeder` with the bootstrap admin.
7. Switch `backend/.env` `database.default.database = epey_v2`.
8. **Cleanup pass:** delete dropped-scope migrations, controllers, models, services. Trim `Routes.php`.
9. Hand the user the manual run sequence (`CREATE DATABASE epey_v2`, `php spark migrate`, `php spark db:seed DatabaseSeeder`, manual register test).

---

## Acceptance test (manual, you run)

### One-time setup
```powershell
# 1. Create the V2 database
mysql -u root -e "CREATE DATABASE epey_v2 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"

# 2. Confirm backend/.env points at epey_v2 (already done by me)
#    database.default.database = epey_v2

# 3. Run migrations (creates 7 tables: users, states, districts, taluks, pincodes,
#    wallet_transactions, system_pools, system_settings, notifications, device_tokens)
cd C:\xampp\htdocs\epey\backend
C:\xampp\php\php.exe spark migrate

# 4. Seed the bootstrap admin (mobile 9999000001, password change-me)
C:\xampp\php\php.exe spark db:seed DatabaseSeeder
```

### Acceptance scenarios

1. **Unreferred signup** — customer-app register without filling "Referral code".
   - Expected: user row created, `level_wallet = 0`, no `wallet_transactions` row.

2. **Referred signup** — customer-app register with `Referral code = 9999000001`.
   - Expected:
     - new user row, `referrer_id = <admin id>`
     - admin `level_wallet` += 15
     - new `wallet_transactions(user_id=<admin>, type='welcome_bonus', amount=15)` row
     - `notifications` row for the admin titled "Welcome bonus credited"
     - if Firebase configured: push notification reaches the admin's device

3. **Disabled bonus** — set `welcome.bonus_active = '0'` in `system_settings` then sign up another referred user.
   - Expected: no level_wallet credit, no `wallet_transactions` row.

4. **Custom amount** — set `welcome.bonus_amount = '25'` then sign up another referred user.
   - Expected: admin `level_wallet` += 25, `wallet_transactions(amount=25)` row.

### Verify admin's view of bonuses given
```sql
SELECT COUNT(*) AS bonuses_given, SUM(amount) AS total_value
FROM wallet_transactions
WHERE type = 'welcome_bonus';
```
This is the "admin sees count + value" view from D4-A. A small admin dashboard panel in Phase 7 will surface this.

### Cleanup performed in this phase
- 24 old migrations (`2026-05-10-*`) deleted — the new database runs only the 7 new `2026-05-14-*` migrations.
- Dropped controllers: `LuckyDrawController`, `SubscriptionController`, `WishlistController`, `SupportController`, `VendorStaffController`, `OtpController`, `ForgotPasswordController`, `PaymentController`, `AdminPaymentController`, `StaffStatsController`, `CsvExportController`, `UploadController`, `ProfileController`.
- Dropped models: `LuckyDraw*`, `Subscription*`, `WishlistItem*`, `Support*`, `VendorStaff*`, `StaffAttendance*`, `StaffSalary*`, `Otp*`, `PasswordReset*`, `PaymentSettings*`, `Payment*`, `CustomerProfile*`.
- Dropped services: `OtpService`, `RazorpayService`.
- Dropped seeder: `StaffSeeder` (replaced by `DatabaseSeeder`).
- `Routes.php` rewritten — only routes for surviving controllers remain.

Some surviving controllers (Order/Cart/Wallet/Token/Withdrawal/etc.) reference tables that don't exist yet in `epey_v2`. Their routes are reachable but they'll error at the SQL layer until Phases 2–7 rebuild their tables. **This is expected** for Phase 1 — only the auth + welcome-bonus + push paths are exercised.

### Known follow-ups
- 4 surviving controllers still reference the dropped `vmanager` role: `TokenController`, `ShopController`, `ProductController`, `VendorManagementController`. These will be rewritten in Phases 2/3/5/6 — vmanager refs will be removed then. No runtime impact in Phase 1 because no `vmanager` user exists (DB enum doesn't include it).
- Customer-app + staff-app pages for dropped scope (lucky-draw, subscriptions, wishlist, support, forgot-password) will 404 on the new backend. Cleaning those frontend pages is a separate cleanup pass.

---

## What's not in this phase
Vendor / taluk / district / state / driver onboarding, products, cart, orders, commissions, buyback, tokens beyond model creation, withdrawals, manual top-ups, staff-app role restructure, push triggers for new flows.
