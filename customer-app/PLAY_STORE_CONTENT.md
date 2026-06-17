# Google Play — App content answers (SPRITHI customer app)

App: **SPRITHI** · package `com.epey.customer` · category **Shopping**.
Fill the Play Console → **App content** tasks using the answers below. Items marked
⚠️ are decisions/legal items you must confirm.

> Privacy policy is live in the app at **`<your-domain>/customer/privacy/`**
> (e.g. `https://app.sprithi.com/customer/privacy/`). Paste that exact URL into
> Play Console → App content → Privacy policy.

---

## 1. Privacy policy
- URL: `<your-domain>/customer/privacy/`
- ⚠️ Update the support email / phone / company name inside `app/privacy/page.tsx`
  and have it reviewed before go-live. Data-deletion section lives at `…/privacy/#data-deletion`.

## 2. App access (sign-in details)
- The app is **login-gated** → choose **"All or some functionality is restricted"**.
- Provide this **demo customer login** for the reviewer:
  - **Mobile: `9000000007`** · **Password: `Sprithi@123`**
  - No OTP / special steps required. (Throwaway customer "Play Reviewer", ₹1000 demo wallet.)
  - ⚠️ This account is created in the **local** DB. Run the SQL below on the
    **production** DB (`u290807677_sprithi_new`) so the reviewer can actually log in:
    ```sql
    INSERT INTO users (name, mobile_number, email, password_hash, role, status, wallet_balance, dob, created_at, updated_at)
    VALUES ('Play Reviewer', '9000000007', 'reviewer@sprithi.com', '$2y$10$fVDWwVFcsQXj.FdcP/E5MexQ8kVT/OlFqdlsh7O7jr6JBMhkm.yE6', 'customer', 'active', 1000.00, '2000-01-01', NOW(), NOW());
    ```

## 3. Ads
- The app shows **in-app promotional banners and vendor videos** (no third-party ad
  network / AdMob). Recommended answer: **"Yes, my app contains ads."**

## 4. Content rating (IARC questionnaire)
- Category: **Reference, News, or Educational / Shopping** (pick Shopping/Utility).
- Violence, sexual content, profanity, controlled substances, gambling → **No** to all.
- Does the app let users **purchase digital or physical goods**? → **Yes**.
- Does it share the user's **location**? → **No** (no GPS; region is selected manually).
- User-generated content shared with others? → **No** (customers don't post public content).
- Expected result: **Everyone / Rated for 3+**.

## 5. Target audience and content
- Target age group: **18 and over only** (registration blocks under-18).
- "Is your app designed for / appeal to children?" → **No**.
- Do not enrol in the Designed-for-Families / Teacher-approved programs.

## 6. Data safety (must match the privacy policy)
**Does your app collect or share user data?** → **Yes.**
**Is data encrypted in transit?** → **Yes** (HTTPS).
**Can users request data deletion?** → **Yes** — link `…/customer/privacy/#data-deletion`.

Declare these **data types — Collected, Linked to the user, purpose = App functionality + Account management** (none for advertising):

| Play category | Data type | Notes |
|---|---|---|
| Personal info | Name | account |
| Personal info | Email address | account |
| Personal info | Phone number | account/login |
| Personal info | Address | delivery addresses |
| Personal info | Other (Date of birth, region) | DOB + state/district/taluk/pincode |
| Financial info | User payment info | bank account no, IFSC, UPI |
| Financial info | Purchase history | orders |
| Financial info | Other financial info | wallet balance + transactions + referral earnings |
| Personal info | Other (Govt ID — PAN) | only if user adds KYC |
| Photos and videos | Photos | PAN image upload (KYC only) |
| App activity | App interactions | cart, browsing, in-app actions |
| Device or other IDs | Device or other IDs | FCM push token |

- **Camera:** used only for on-device QR scanning → **not** "collected" (nothing leaves the device). Do **not** list camera images as collected data.
- **Shared data:** delivery address + order details are shared with the **vendor and delivery partner** to fulfil the order → declare Address + relevant order data as **Shared**.
- **Location:** do **not** declare Location (no GPS used).

## 7. Government apps
- **No** — not a government app.

## 8. Financial features ⚠️
- The app has an in-app **wallet, money transfer/send, withdrawals to bank, and
  referral/MLM commissions**. Tick the financial-feature declarations that apply
  (e.g. "Manages users' funds / facilitates payments").
- Crypto, lending, real-money gambling, investments → **No**.
- ⚠️ **Read Google Play's Financial Services policy** before submitting. A wallet +
  bank withdrawal + multi-level referral-commission model can attract policy review.
  Do not present referral commissions as guaranteed income/earnings claims in the
  listing or app.

## 9. Health
- **No** health/medical data is collected. (Siddha-medicine *products* may be listed,
  but the app collects no health data.) → No.

## 10. App category & contact details
- Category: **Shopping**.
- Contact: public **support email**, **phone**, and **website**.

## 11. Store listing (copy you can paste)

**App name:** SPRITHI

**Short description (≤80 chars):**
> Shop local stores, pay from your wallet, fast delivery — all in one app.

**Full description:**
> SPRITHI is a wallet-powered local marketplace that brings your neighbourhood shops
> to your phone. Browse groceries, textiles, beauty, baby products, medicines and more
> from nearby vendors, add to cart, and get them delivered fast.
>
> • One wallet for every shop — pay in seconds, or choose Cash on Delivery.
> • Discover local vendors and their latest products and offers.
> • Track every order from placement to doorstep.
> • Cancel orders within the allowed window and request returns after delivery.
> • Refer friends and earn rewards to your wallet.
> • Save multiple delivery addresses and reorder in a tap.
>
> SPRITHI partners with local shops and delivery agents so you get convenience while
> supporting your local economy.

**Graphics needed (upload separately):**
- App icon: 512×512 PNG
- Feature graphic: 1024×500 PNG
- Phone screenshots: at least 2 (min 320px, up to 3840px)

**Contact details:** support email + phone + `<your-domain>`.

---

### Quick checklist
- [ ] Host privacy policy → paste URL
- [ ] Create + provide demo login for reviewer
- [ ] Ads = Yes · Content rating questionnaire · Target audience 18+
- [ ] Data safety form per table above (+ deletion URL)
- [ ] Financial features declared (review FS policy)
- [ ] Government = No · Health = No
- [ ] Category Shopping + contact details
- [ ] Store listing text + icon/feature graphic/screenshots
