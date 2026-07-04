<?php

use CodeIgniter\Router\RouteCollection;

/**
 * @var RouteCollection $routes
 */
$routes->get('/', 'Home::index');

// Referral deep-link landing + Android App Links verification (public, no API).
$routes->get('ref/(:segment)', 'RefController::landing/$1');
$routes->get('.well-known/assetlinks.json', 'WellKnown::assetlinks');

$routes->options('(:any)', static function () {
    return service('response')->setStatusCode(204);
});

$routes->group('api/v1', ['filter' => 'cors'], static function ($routes) {
    // ===== Auth =====
    $routes->group('auth', static function ($routes) {
        // Distinct buckets per endpoint (sharing a bucket would drain each other's
        // quota). OTP/login/register also carry a per-mobile limit so users behind
        // one shared carrier IP (CGNAT) aren't throttled together.
        $routes->post('register',    'Api\AuthController::register',   ['filter' => 'rate_limit:register,20,3600,mobile_number,5,3600']);
        $routes->post('otp/send',    'Api\AuthController::sendOtp',    ['filter' => 'rate_limit:otp,30,3600,mobile_number,5,3600']);
        $routes->get('check-mobile', 'Api\AuthController::checkMobile', ['filter' => 'rate_limit:check-mobile,100,300']);
        $routes->post('login',       'Api\AuthController::login',      ['filter' => 'rate_limit:login,120,300,mobile_number,60,900']);
        // Staff are a small, trusted group (not a public brute-force target like
        // customer login) — own bucket (won't drain customer login's per-IP quota)
        // with looser caps: 60/5min per IP, 20/15min per mobile.
        $routes->post('staff-login',     'Api\AuthController::staffLogin', ['filter' => 'rate_limit:staff-login,60,300,mobile_number,20,900']);
        $routes->post('forgot-password', 'Api\AuthController::forgotPassword', ['filter' => 'rate_limit:forgot,15,3600']);
        $routes->post('reset-password',  'Api\AuthController::resetPassword',  ['filter' => 'rate_limit:reset,20,3600']);
        $routes->post('forgot-password-otp', 'Api\AuthController::sendResetOtp',     ['filter' => 'rate_limit:otp,30,3600,mobile_number,5,3600']);
        $routes->post('reset-password-otp',  'Api\AuthController::resetPasswordOtp', ['filter' => 'rate_limit:reset,20,3600']);
        // Staff/admin password reset by mobile OTP (they sign in by mobile too).
        $routes->post('staff/forgot-password-otp', 'Api\AuthController::sendStaffResetOtp',     ['filter' => 'rate_limit:otp,30,3600,mobile_number,5,3600']);
        $routes->post('staff/reset-password-otp',  'Api\AuthController::resetStaffPasswordOtp', ['filter' => 'rate_limit:reset,20,3600']);
        $routes->post('refresh',         'Api\AuthController::refresh');
    });
    $routes->group('auth', ['filter' => 'auth'], static function ($routes) {
        $routes->get('me',      'Api\AuthController::me');
        $routes->post('logout', 'Api\AuthController::logout');
        $routes->patch('me/address', 'Api\AuthController::updateAddress');
        $routes->patch('me/bank',    'Api\AuthController::updateBank');
        $routes->patch('me/shift',   'Api\AuthController::updateShift');
        $routes->post('me/shop-image', 'Api\AuthController::updateShopImage');
    });

    // ===== Ad requests (vendor submits banner/video; admin reviews) =====
    $routes->group('ads', ['filter' => 'auth'], static function ($routes) {
        $routes->post('requests/upload', 'Api\AdRequestController::upload');
        $routes->post('requests',        'Api\AdRequestController::create');
        $routes->get('requests/mine',    'Api\AdRequestController::mine');
    });

    // ===== Devices + notifications (Phase 1 + push infra) =====
    $routes->group('devices', ['filter' => 'auth'], static function ($routes) {
        $routes->post('register',   'Api\DeviceController::register');
        $routes->post('unregister', 'Api\DeviceController::unregister');
    });
    $routes->group('notifications', ['filter' => 'auth'], static function ($routes) {
        $routes->get('/',            'Api\NotificationController::index');
        $routes->patch('(:num)/read','Api\NotificationController::markRead/$1');
        $routes->post('send',        'Api\NotificationController::send');
    });

    // ===== Public landing (works against V2 once Phase 2 lands; left routed so the controller is reachable) =====
    $routes->get('public/home',                'Api\PublicController::home');
    $routes->get('public/top-selling',         'Api\PublicController::topSelling');   // ranked by sold qty (fulfilled orders)
    $routes->get('public/flash-sale',          'Api\PublicController::flashSale');    // live limited-time discounts
    $routes->get('public/products',            'Api\PublicController::products');
    $routes->get('public/products/(:num)',     'Api\PublicController::product/$1');
    $routes->get('public/vendors',             'Api\PublicController::vendors');
    $routes->get('public/referrer/(:num)',     'Api\PublicController::referrer/$1');
    $routes->get('public/pincodes',            'Api\PincodeController::index');
    $routes->get('public/pincodes/(:segment)', 'Api\PincodeController::lookup/$1');
    $routes->get('public/products/(:num)/options','Api\ProductVariantController::listForProduct/$1');
    $routes->get('public/locations',           'Api\PublicController::locations');

    // ===== Catalog + cart + orders (Phase 2/3 will rebuild — routes kept so controllers are reachable) =====
    $routes->group('catalog', ['filter' => 'auth'], static function ($routes) {
        $routes->get('categories',               'Api\CategoryController::index');
        $routes->get('sub-categories',           'Api\SubCategoryController::index');   // ?category_id=N → product-form 3rd cascade + filters
        $routes->get('products',                 'Api\ProductController::index');
        $routes->get('products/(:num)',          'Api\ProductController::show/$1');
        $routes->get('products/(:num)/options',  'Api\ProductVariantController::listForProduct/$1');
        $routes->get('shops',                    'Api\ShopController::customerIndex');
        $routes->get('shop-banners',             'Api\ShopController::shopBanners');
        $routes->get('shops/(:num)',             'Api\ShopController::customerShow/$1');
        $routes->get('variant-type-groups',      'Api\VariantTypeGroupController::index');
    });

    $routes->post('purchase/qr', 'Api\PurchaseController::fromQr', ['filter' => 'auth']);
    // Vendor-initiated in-store charge: vendor enters the customer's mobile + amount.
    $routes->post('purchase/from-customer', 'Api\PurchaseController::fromCustomer', ['filter' => 'auth']);
    // Vendor: a customer's real orders (by mobile) to link an ONLINE customer purchase to.
    $routes->get('purchase/customer-orders', 'Api\PurchaseController::customerOrders', ['filter' => 'auth']);
    $routes->get('purchase/customer-lookup', 'Api\PurchaseController::customerLookup', ['filter' => 'auth']);
    // Vendor's own in-store/QR purchase history (shown on the QR scanner page).
    $routes->get('purchase/mine', 'Api\PurchaseController::mine', ['filter' => 'auth']);
    // Vendor: move one QR purchase's share from the QR wallet to the main wallet.
    $routes->post('purchase/(:num)/transfer', 'Api\PurchaseController::transferOne/$1', ['filter' => 'auth']);
    // Vendor: move the WHOLE QR wallet to the main wallet in one transfer.
    $routes->post('purchase/transfer-all', 'Api\PurchaseController::transferAllQr', ['filter' => 'auth']);

    $routes->group('vendor/products', ['filter' => 'auth'], static function ($routes) {
        $routes->post('(:num)/variants',                 'Api\ProductVariantController::createVariant/$1');
        $routes->patch('(:num)/variants/(:num)',         'Api\ProductVariantController::updateVariant/$1/$2');
        $routes->delete('(:num)/variants/(:num)',        'Api\ProductVariantController::deleteVariant/$1/$2');
    });

    // Vendor dashboard one-shot payload (counters + 14d orders + recent orders)
    $routes->get('vendor/stats/dashboard', 'Api\AdminStatsController::vendorDashboard', ['filter' => 'auth']);

    // Staff dashboard for taluk/district/state (counters + 14d txns + team below)
    $routes->get('staff/stats/dashboard',  'Api\AdminStatsController::staffDashboard',  ['filter' => 'auth']);

    // Driver dashboard (pending / delivered today / total / monthly salary + 14d series)
    $routes->get('driver/stats/dashboard', 'Api\AdminStatsController::driverDashboard', ['filter' => 'auth']);

    $routes->group('cart', ['filter' => 'auth'], static function ($routes) {
        $routes->get('/',           'Api\CartController::index');
        $routes->post('add',        'Api\CartController::add');
        $routes->patch('(:num)',    'Api\CartController::setQty/$1');
        $routes->delete('(:num)',   'Api\CartController::remove/$1');
        $routes->delete('/',        'Api\CartController::clear');
    });

    $routes->group('orders', ['filter' => 'auth'], static function ($routes) {
        $routes->post('place',         'Api\OrderController::place');
        $routes->post('place-prescription', 'Api\OrderController::placePrescription');   // customer: Rx-only order
        $routes->post('(:num)/bill',   'Api\OrderController::bill/$1');                    // vendor: add items/price to an Rx order
        $routes->post('prescription-upload', 'Api\OrderController::uploadPrescription');
        $routes->get('qr-payable',     'Api\OrderController::qrPayable');                  // customer: order payable by scanning a vendor QR
        $routes->get('qr-payments',    'Api\OrderController::qrPayments');                 // vendor: QR-paid orders table
        $routes->post('(:num)/qr-pay', 'Api\OrderController::qrPay/$1');                   // customer: pay a COD order via QR (wallet)
        $routes->post('(:num)/qr-visibility', 'Api\OrderController::setQrVisibility/$1');  // vendor: show/hide pickup QR for driver
        $routes->get('mine',           'Api\OrderController::mine');
        $routes->get('list',           'Api\OrderController::listForRole');
        $routes->get('(:num)',         'Api\OrderController::show/$1');
        $routes->patch('(:num)/status','Api\OrderController::setStatus/$1');
        $routes->patch('(:num)/driver','Api\OrderController::setDriver/$1');   // vendor+admin: assign delivery driver
        $routes->post('(:num)/return', 'Api\OrderController::requestReturn/$1');
        $routes->post('(:num)/cancel', 'Api\OrderController::cancel/$1');
    });
    // Vendor: review return requests on their OWN orders (replaces admin-only flow).
    $routes->get('vendor/returns',                 'Api\VendorReturnController::index',      ['filter' => 'auth']);
    $routes->post('vendor/returns/(:num)/approve', 'Api\VendorReturnController::approve/$1', ['filter' => 'auth']);
    $routes->post('vendor/returns/(:num)/reject',  'Api\VendorReturnController::reject/$1',  ['filter' => 'auth']);

    // Driver-scoped: orders for the current driver's assigned vendor (awaiting delivery).
    $routes->get('driver/orders', 'Api\OrderController::driverOrders', ['filter' => 'auth']);
    // Driver scans the shop QR to confirm pickup → order goes out for delivery.
    $routes->post('driver/orders/(:num)/pickup', 'Api\OrderController::driverPickup/$1', ['filter' => 'auth']);

    // Customer-scoped: KM slabs for the current cart's vendor's taluk.
    $routes->get('customer/delivery-rates/km', 'Api\DeliveryRateController::customerSlabs', ['filter' => 'auth']);
    // Customer-scoped: time-based delivery rates (checkout delivery-fee dropdown).
    $routes->get('customer/delivery-rates/time', 'Api\DeliveryRateController::customerTimeRates', ['filter' => 'auth']);
    // Customer-scoped: live rule-based delivery-charge quote (Free / flat amount).
    $routes->get('customer/delivery-quote', 'Api\DeliveryRateController::customerDeliveryQuote', ['filter' => 'auth']);

    // Customer-scoped: submit a video to admin for approval (shown on home once approved).
    $routes->post('customer/videos/upload', 'Api\CustomerVideoController::customerUpload', ['filter' => 'auth']);
    $routes->post('customer/videos',        'Api\CustomerVideoController::customerSubmit', ['filter' => 'auth']);
    $routes->get('customer/videos/mine',    'Api\CustomerVideoController::mySubmissions', ['filter' => 'auth']);

    // Customer-scoped: saved delivery addresses (multiple + one default).
    $routes->group('customer/addresses', ['filter' => 'auth'], static function ($routes) {
        $routes->get('/',               'Api\AddressController::index');
        $routes->post('/',              'Api\AddressController::create');
        $routes->patch('(:num)',        'Api\AddressController::update/$1');
        $routes->post('(:num)/default', 'Api\AddressController::setDefault/$1');
        $routes->delete('(:num)',       'Api\AddressController::delete/$1');
    });

    // Customer-scoped: KYC documents + image upload (required before withdrawal).
    $routes->group('customer', ['filter' => 'auth'], static function ($routes) {
        $routes->post('upload', 'Api\KycController::upload');
        $routes->get('kyc',     'Api\KycController::mine');
        $routes->post('kyc',    'Api\KycController::save');
    });

    // ===== Wallet + withdrawals (Phase 4 will rebuild) =====
    $routes->group('wallet', ['filter' => 'auth'], static function ($routes) {
        $routes->get('balance',      'Api\WalletController::balance');
        $routes->get('wallets',      'Api\WalletController::wallets');
        $routes->get('transactions', 'Api\WalletController::transactions');
        $routes->get('global-history','Api\WalletController::globalHistory');
        $routes->get('history',       'Api\WalletController::history');
        // Money-moving endpoints get an abuse throttle on top of auth (the array
        // form keeps the auth filter explicitly so it's never dropped).
        $routes->post('send',        'Api\WalletController::send',     ['filter' => ['auth', 'rate_limit:wallet-send,50,3600']]);
        $routes->post('transfer',    'Api\WalletController::transfer', ['filter' => ['auth', 'rate_limit:wallet-transfer,60,3600']]);
    });
    $routes->group('withdrawals', ['filter' => 'auth'], static function ($routes) {
        $routes->post('/',   'Api\WithdrawalController::create', ['filter' => ['auth', 'rate_limit:withdraw,20,3600']]);
        $routes->get('mine', 'Api\WithdrawalController::mine');
    });

    // ===== Referrals =====
    $routes->group('referrals', ['filter' => 'auth'], static function ($routes) {
        $routes->get('info', 'Api\ReferralController::info');
        $routes->get('list', 'Api\ReferralController::list');
    });

    $routes->group('vendor', ['filter' => 'auth'], static function ($routes) {
        $routes->get('products',         'Api\ProductController::mine');
        $routes->post('products/bulk',   'Api\ProductController::bulkCreate');
        $routes->post('products/import', 'Api\ProductController::vendorImport');
        $routes->post('products/import-images', 'Api\ProductController::importImagesUpload');           // upload + extract images ZIP
        $routes->post('products/import-images/cleanup', 'Api\ProductController::importImagesCleanup');  // remove extracted temp
        $routes->get('products/export-images',  'Api\ProductController::exportImages');                 // download a ZIP of the vendor's product images
        $routes->post('products',        'Api\ProductController::create');
        $routes->patch('products/(:num)','Api\ProductController::update/$1');
        $routes->delete('products/(:num)','Api\ProductController::delete/$1');
        $routes->post('products/bulk-delete', 'Api\ProductController::bulkDelete');   // vendor: soft-delete many at once
        $routes->post('categories',      'Api\CategoryController::ensure');
        $routes->post('sub-categories',  'Api\SubCategoryController::ensure');   // CSV import: create/reuse sub-cats under a category
        $routes->get('me/category',      'Api\VendorCategoryController::mine');
    });

    // Public list of active vendor categories (for registration / shop browse).
    $routes->get('vendor-categories', 'Api\VendorCategoryController::index');

    // Public list of home banners (grouped by slot) — used by customer-app home page.
    $routes->get('public/banners', 'Api\BannerController::publicIndex');

    // Home video carousels (customer-app home): admin-managed + approved vendor videos.
    $routes->get('public/customer-videos', 'Api\CustomerVideoController::publicIndex');
    $routes->get('public/vendor-videos',   'Api\AdRequestController::publicVideos');

    // Logged-in user's own activity (wallet + referrals + notifications)
    $routes->get('activity/mine', 'Api\ActivityController::mine', ['filter' => 'auth']);

    // Blog (public read)
    $routes->get('public/blog',                'Api\BlogController::publicIndex');
    $routes->get('public/blog/(:segment)',     'Api\BlogController::publicShow/$1');

    // ===== Geo (Phase 1 schema; admin CRUD) =====
    $routes->group('geo', ['filter' => 'auth'], static function ($routes) {
        $routes->get('states',              'Api\GeoController::states');
        $routes->post('states',             'Api\GeoController::createState');
        $routes->patch('states/(:num)',     'Api\GeoController::updateState/$1');
        $routes->delete('states/(:num)',    'Api\GeoController::deleteState/$1');
        $routes->post('states/(:num)/reset-password', 'Api\GeoController::resetStatePassword/$1');
        $routes->get('districts',           'Api\GeoController::districts');
        $routes->post('districts',          'Api\GeoController::createDistrict');
        $routes->patch('districts/(:num)',  'Api\GeoController::updateDistrict/$1');
        $routes->delete('districts/(:num)', 'Api\GeoController::deleteDistrict/$1');
        $routes->post('districts/(:num)/reset-password', 'Api\GeoController::resetDistrictPassword/$1');
        $routes->get('taluks',              'Api\GeoController::taluks');
        $routes->post('taluks',             'Api\GeoController::createTaluk');
        $routes->patch('taluks/(:num)',     'Api\GeoController::updateTaluk/$1');
        $routes->delete('taluks/(:num)',    'Api\GeoController::deleteTaluk/$1');
        $routes->post('taluks/(:num)/reset-password', 'Api\GeoController::resetTalukPassword/$1');
    });

    // ===== Tokens (Phase 5 will rebuild) =====
    $routes->group('tokens', ['filter' => 'auth'], static function ($routes) {
        $routes->get('upstream-bank',       'Api\TokenController::upstreamBank');
        $routes->post('distribute',         'Api\TokenController::distribute');
        $routes->get('distribute/quote',    'Api\TokenController::quote');
        $routes->get('distribute/history',  'Api\TokenController::distributeHistory');
        $routes->post('requests',           'Api\TokenController::requestCreate');
        $routes->post('requests/upload',    'Api\TokenController::requestUpload');
        $routes->get('requests/inbox',      'Api\TokenController::inbox');
        $routes->get('requests/mine',       'Api\TokenController::requestMine');
        $routes->get('requests/(:num)',     'Api\TokenController::requestShow/$1');
        $routes->patch('requests/(:num)',   'Api\TokenController::requestUpdate/$1');
        $routes->post('requests/(:num)/cancel',   'Api\TokenController::requestCancel/$1');
        $routes->post('requests/(:num)/approve',  'Api\TokenController::requestApprove/$1');
        $routes->post('requests/(:num)/escalate', 'Api\TokenController::requestEscalate/$1');
        $routes->post('requests/(:num)/reject',   'Api\TokenController::requestReject/$1');
        $routes->post('admin/credit',             'Api\TokenController::adminCredit');
    });

    // ===== Driver management =====
    $routes->group('drivers', ['filter' => 'auth'], static function ($routes) {
        $routes->get('/',                       'Api\DriverManagementController::index');                // admin
        $routes->post('/',                      'Api\DriverManagementController::create');               // admin
        $routes->patch('(:num)',                'Api\DriverManagementController::update/$1');            // admin
        $routes->post('(:num)/block',           'Api\DriverManagementController::block/$1');             // admin
        $routes->post('(:num)/unblock',         'Api\DriverManagementController::unblock/$1');           // admin
        $routes->post('(:num)/reset-password',  'Api\DriverManagementController::resetPassword/$1');     // admin
        $routes->post('(:num)/assign-vendor',   'Api\DriverManagementController::assignVendor/$1');      // taluk+admin
    });
    // Taluk-scoped driver listing
    $routes->get('staff/drivers', 'Api\DriverManagementController::talukIndex', ['filter' => 'auth']);

    // ===== Vendor management (Phase 2/6 will revisit) =====
    $routes->group('vendors', ['filter' => 'auth'], static function ($routes) {
        $routes->get('/',                  'Api\VendorManagementController::index');
        $routes->get('(:num)',             'Api\VendorManagementController::show/$1');
        $routes->post('/',                 'Api\VendorManagementController::create');
        $routes->patch('(:num)',           'Api\VendorManagementController::update/$1');
        $routes->post('(:num)/block',          'Api\VendorManagementController::block/$1');
        $routes->post('(:num)/unblock',        'Api\VendorManagementController::unblock/$1');
        $routes->post('(:num)/reset-password', 'Api\VendorManagementController::resetPassword/$1');
    });

    // ===== Vendor templates (admin-only) — reusable category+commission presets =====
    $routes->get('vendor-templates',           'Api\VendorTemplateController::index',      ['filter' => 'auth']);
    $routes->post('vendor-templates',          'Api\VendorTemplateController::store',      ['filter' => 'auth']);
    $routes->delete('vendor-templates/(:num)', 'Api\VendorTemplateController::destroy/$1', ['filter' => 'auth']);

    // ===== Admin (Phase 4 will rebuild payments + withdrawals admin; Phase 7 stats + exports) =====
    $routes->group('admin', ['filter' => 'auth'], static function ($routes) {
        // ad requests (vendor banner/video) — review inbox
        $routes->get('ad-requests',                  'Api\AdRequestController::adminIndex');
        $routes->post('ad-requests/(:num)/approve',  'Api\AdRequestController::approve/$1');
        $routes->post('ad-requests/(:num)/reject',   'Api\AdRequestController::reject/$1');
        $routes->post('ad-requests/(:num)/use-as-banner', 'Api\AdRequestController::useAsBanner/$1');
        $routes->post('ad-requests/(:num)/deactivate', 'Api\AdRequestController::deactivate/$1');
        $routes->post('ad-requests/(:num)/reactivate', 'Api\AdRequestController::reactivate/$1');
        // customer videos (admin-managed home carousel)
        $routes->get('customer-videos',           'Api\CustomerVideoController::adminIndex');
        $routes->post('customer-videos/upload',   'Api\CustomerVideoController::upload');
        $routes->post('customer-videos',          'Api\CustomerVideoController::create');
        $routes->patch('customer-videos/(:num)',  'Api\CustomerVideoController::update/$1');
        $routes->delete('customer-videos/(:num)', 'Api\CustomerVideoController::delete/$1');
        // shop image approval (vendor uploads → admin approves/rejects)
        $routes->get('shop-images',                  'Api\AdminShopImageController::index');
        $routes->post('shop-images/(:num)/approve',  'Api\AdminShopImageController::approve/$1');
        $routes->post('shop-images/(:num)/reject',   'Api\AdminShopImageController::reject/$1');
        $routes->post('shop-images/(:num)/deactivate','Api\AdminShopImageController::deactivate/$1');
        $routes->post('shop-images/(:num)/reactivate','Api\AdminShopImageController::reactivate/$1');
        // return requests (customer requests → admin approves/rejects)
        $routes->get('returns',                      'Api\AdminReturnController::index');
        $routes->post('returns/(:num)/approve',      'Api\AdminReturnController::approve/$1');
        $routes->post('returns/(:num)/reject',       'Api\AdminReturnController::reject/$1');
        // customers
        $routes->get('customers',                    'Api\AdminUsersController::customers');
        $routes->get('customers/(:num)',             'Api\AdminUsersController::show/$1');
        $routes->post('customers',                   'Api\AdminUsersController::create');
        $routes->post('products/import',             'Api\ProductController::adminImport');
        $routes->post('products/import-images',          'Api\ProductController::importImagesUpload');
        $routes->post('products/import-images/cleanup',  'Api\ProductController::importImagesCleanup');
        $routes->get('products/export-images',           'Api\ProductController::exportImages');
        $routes->patch('customers/(:num)',           'Api\AdminUsersController::update/$1');
        $routes->post('customers/(:num)/activate',   'Api\AdminUsersController::activate/$1');
        $routes->post('customers/(:num)/deactivate', 'Api\AdminUsersController::deactivate/$1');
        $routes->post('customers/(:num)/wallet',     'Api\AdminUsersController::wallet/$1');

        // categories
        $routes->get('categories',          'Api\CategoryController::adminIndex');
        $routes->post('categories',         'Api\CategoryController::create');
        $routes->patch('categories/(:num)', 'Api\CategoryController::update/$1');
        $routes->delete('categories/(:num)','Api\CategoryController::delete/$1');

        // sub categories (Vendor Category → Product Category → Sub Category)
        $routes->get('sub-categories',          'Api\SubCategoryController::adminIndex');
        $routes->post('sub-categories',         'Api\SubCategoryController::create');
        $routes->patch('sub-categories/(:num)', 'Api\SubCategoryController::update/$1');
        $routes->delete('sub-categories/(:num)','Api\SubCategoryController::delete/$1');

        // vendor categories (with attribute_schema for dynamic product fields)
        $routes->get('vendor-categories',          'Api\VendorCategoryController::adminIndex');
        $routes->post('vendor-categories',         'Api\VendorCategoryController::create');
        $routes->post('vendor-categories/reorder', 'Api\VendorCategoryController::reorder');
        $routes->patch('vendor-categories/(:num)', 'Api\VendorCategoryController::update/$1');
        $routes->delete('vendor-categories/(:num)','Api\VendorCategoryController::delete/$1');

        // variant type groups (Mobile / Laptop / Clothes / etc. with name+values fields)
        $routes->get('variant-type-groups',           'Api\VariantTypeGroupController::adminIndex');
        $routes->post('variant-type-groups',          'Api\VariantTypeGroupController::create');
        $routes->patch('variant-type-groups/(:num)',  'Api\VariantTypeGroupController::update/$1');
        $routes->delete('variant-type-groups/(:num)', 'Api\VariantTypeGroupController::delete/$1');

        // home banners (coupon + hero + mega offer slots)
        $routes->get('banners',          'Api\BannerController::adminIndex');
        $routes->post('banners',         'Api\BannerController::create');
        $routes->patch('banners/(:num)', 'Api\BannerController::update/$1');
        $routes->delete('banners/(:num)','Api\BannerController::delete/$1');

        // withdrawals admin (Phase 4 will rebuild controller; route reachable now)
        $routes->get('withdrawals/pending',         'Api\WithdrawalController::pending');
        $routes->post('withdrawals/(:num)/approve', 'Api\WithdrawalController::approve/$1');
        $routes->post('withdrawals/(:num)/reject',  'Api\WithdrawalController::reject/$1');

        // KYC review (one-time verification before customers can withdraw)
        $routes->get('kyc/pending',          'Api\KycController::pending');
        $routes->post('kyc/(:num)/verify',   'Api\KycController::verify/$1');
        $routes->post('kyc/(:num)/reject',   'Api\KycController::reject/$1');

        // token requests
        $routes->get('token-requests',                  'Api\TokenController::adminRequests');
        $routes->post('token-requests/(:num)/process',  'Api\TokenController::adminProcess/$1');

        // shops (admin filterable)
        $routes->get('shops', 'Api\ShopController::adminIndex');

        // pincodes
        $routes->get('pincodes',           'Api\PincodeController::index');
        $routes->post('pincodes',          'Api\PincodeController::create');
        $routes->patch('pincodes/(:num)',  'Api\PincodeController::update/$1');
        $routes->delete('pincodes/(:num)', 'Api\PincodeController::delete/$1');

        // system settings
        $routes->get('settings',   'Api\AdminSettingsController::index');
        $routes->patch('settings', 'Api\AdminSettingsController::update');

        // activity log (aggregates signups, referrals, wallet_transactions — no new table)
        $routes->get('activity', 'Api\ActivityController::index');

        // dashboard one-shot payload (counters + 14d series + top cats + recent orders + latest vendors)
        $routes->get('stats/dashboard', 'Api\AdminStatsController::dashboard');

        // delivery rates (KM slabs + time tiers per taluk)
        $routes->get('delivery-rates/km',               'Api\DeliveryRateController::indexKm');
        $routes->post('delivery-rates/km',              'Api\DeliveryRateController::createKm');
        $routes->patch('delivery-rates/km/(:num)',      'Api\DeliveryRateController::updateKm/$1');
        $routes->delete('delivery-rates/km/(:num)',     'Api\DeliveryRateController::deleteKm/$1');
        $routes->get('delivery-rates/time',             'Api\DeliveryRateController::indexTime');
        $routes->post('delivery-rates/time',            'Api\DeliveryRateController::createTime');
        $routes->patch('delivery-rates/time/(:num)',    'Api\DeliveryRateController::updateTime/$1');
        $routes->delete('delivery-rates/time/(:num)',   'Api\DeliveryRateController::deleteTime/$1');

        // driver shifts (admin-defined shift names + timing ranges)
        $routes->get('driver-shifts',           'Api\DriverShiftController::index');
        $routes->post('driver-shifts',          'Api\DriverShiftController::create');
        $routes->patch('driver-shifts/(:num)',  'Api\DriverShiftController::update/$1');
        $routes->delete('driver-shifts/(:num)', 'Api\DriverShiftController::delete/$1');

        // current global pool balance + last 12 months of monthly_global_pools rows
        $routes->get('wallet/global-pool', 'Api\WalletController::adminGlobalPool');
        // admin manual wallet top-up + manual global-pool distribution
        $routes->post('wallet/topup',      'Api\WalletController::adminTopup');
        $routes->post('global/distribute', 'Api\WalletController::adminDistributeGlobal');

        // lucky draw pools (3% slot from every order; admin picks winner)
        $routes->get('lucky-draw/pools',                       'Api\LuckyDrawController::pools');
        $routes->get('lucky-draw/entries',                     'Api\LuckyDrawController::entries');
        $routes->post('lucky-draw/pools/(:num)/pick-winner',   'Api\LuckyDrawController::pickWinner/$1');

        // blog posts (admin CRUD)
        $routes->get('blog',           'Api\BlogController::adminIndex');
        $routes->get('blog/(:num)',    'Api\BlogController::adminShow/$1');
        $routes->post('blog',          'Api\BlogController::create');
        $routes->patch('blog/(:num)',  'Api\BlogController::update/$1');
        $routes->delete('blog/(:num)', 'Api\BlogController::delete/$1');
    });
});
