<?php

use CodeIgniter\Router\RouteCollection;

/**
 * @var RouteCollection $routes
 */
$routes->get('/', 'Home::index');

$routes->options('(:any)', static function () {
    return service('response')->setStatusCode(204);
});

$routes->group('api/v1', ['filter' => 'cors'], static function ($routes) {
    // ===== Auth =====
    $routes->group('auth', static function ($routes) {
        $routes->post('register', 'Api\AuthController::register', ['filter' => 'rate_limit:auth-register,10,3600']);
        $routes->post('login',    'Api\AuthController::login',    ['filter' => 'rate_limit:auth-login,10,300']);
        $routes->post('refresh',  'Api\AuthController::refresh');
    });
    $routes->group('auth', ['filter' => 'auth'], static function ($routes) {
        $routes->get('me',      'Api\AuthController::me');
        $routes->post('logout', 'Api\AuthController::logout');
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
    $routes->get('public/products',            'Api\PublicController::products');
    $routes->get('public/products/(:num)',     'Api\PublicController::product/$1');
    $routes->get('public/vendors',             'Api\PublicController::vendors');
    $routes->get('public/pincodes',            'Api\PincodeController::index');
    $routes->get('public/pincodes/(:segment)', 'Api\PincodeController::lookup/$1');
    $routes->get('public/products/(:num)/options','Api\ProductVariantController::listForProduct/$1');
    $routes->get('public/locations',           'Api\PublicController::locations');

    // ===== Catalog + cart + orders (Phase 2/3 will rebuild — routes kept so controllers are reachable) =====
    $routes->group('catalog', ['filter' => 'auth'], static function ($routes) {
        $routes->get('categories',               'Api\CategoryController::index');
        $routes->get('products',                 'Api\ProductController::index');
        $routes->get('products/(:num)',          'Api\ProductController::show/$1');
        $routes->get('products/(:num)/options',  'Api\ProductVariantController::listForProduct/$1');
        $routes->get('shops',                    'Api\ShopController::customerIndex');
        $routes->get('shops/(:num)',             'Api\ShopController::customerShow/$1');
        $routes->get('variant-type-groups',      'Api\VariantTypeGroupController::index');
    });

    $routes->post('purchase/qr', 'Api\PurchaseController::fromQr', ['filter' => 'auth']);

    $routes->group('vendor/products', ['filter' => 'auth'], static function ($routes) {
        $routes->post('(:num)/variants',                 'Api\ProductVariantController::createVariant/$1');
        $routes->patch('(:num)/variants/(:num)',         'Api\ProductVariantController::updateVariant/$1/$2');
        $routes->delete('(:num)/variants/(:num)',        'Api\ProductVariantController::deleteVariant/$1/$2');
    });

    // Vendor dashboard one-shot payload (counters + 14d orders + recent orders)
    $routes->get('vendor/stats/dashboard', 'Api\AdminStatsController::vendorDashboard', ['filter' => 'auth']);

    // Staff dashboard for taluk/district/state (counters + 14d txns + team below)
    $routes->get('staff/stats/dashboard',  'Api\AdminStatsController::staffDashboard',  ['filter' => 'auth']);

    $routes->group('cart', ['filter' => 'auth'], static function ($routes) {
        $routes->get('/',           'Api\CartController::index');
        $routes->post('add',        'Api\CartController::add');
        $routes->patch('(:num)',    'Api\CartController::setQty/$1');
        $routes->delete('(:num)',   'Api\CartController::remove/$1');
        $routes->delete('/',        'Api\CartController::clear');
    });

    $routes->group('orders', ['filter' => 'auth'], static function ($routes) {
        $routes->post('place',         'Api\OrderController::place');
        $routes->get('mine',           'Api\OrderController::mine');
        $routes->get('list',           'Api\OrderController::listForRole');
        $routes->get('(:num)',         'Api\OrderController::show/$1');
        $routes->patch('(:num)/status','Api\OrderController::setStatus/$1');
    });

    // ===== Wallet + withdrawals (Phase 4 will rebuild) =====
    $routes->group('wallet', ['filter' => 'auth'], static function ($routes) {
        $routes->get('balance',      'Api\WalletController::balance');
        $routes->get('wallets',      'Api\WalletController::wallets');
        $routes->get('transactions', 'Api\WalletController::transactions');
        $routes->get('global-history','Api\WalletController::globalHistory');
        $routes->get('history',       'Api\WalletController::history');
        $routes->post('send',        'Api\WalletController::send');
        $routes->post('transfer',    'Api\WalletController::transfer');
    });
    $routes->group('withdrawals', ['filter' => 'auth'], static function ($routes) {
        $routes->post('/',   'Api\WithdrawalController::create');
        $routes->get('mine', 'Api\WithdrawalController::mine');
    });

    // ===== Referrals =====
    $routes->group('referrals', ['filter' => 'auth'], static function ($routes) {
        $routes->get('info', 'Api\ReferralController::info');
        $routes->get('list', 'Api\ReferralController::list');
    });

    $routes->group('vendor', ['filter' => 'auth'], static function ($routes) {
        $routes->get('products',         'Api\ProductController::mine');
        $routes->post('products',        'Api\ProductController::create');
        $routes->patch('products/(:num)','Api\ProductController::update/$1');
        $routes->delete('products/(:num)','Api\ProductController::delete/$1');
        $routes->get('me/category',      'Api\VendorCategoryController::mine');
    });

    // Public list of active vendor categories (for registration / shop browse).
    $routes->get('vendor-categories', 'Api\VendorCategoryController::index');

    // Public list of home banners (grouped by slot) — used by customer-app home page.
    $routes->get('public/banners', 'Api\BannerController::publicIndex');

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
        $routes->post('distribute',         'Api\TokenController::distribute');
        $routes->get('distribute/quote',    'Api\TokenController::quote');
        $routes->get('distribute/history',  'Api\TokenController::distributeHistory');
        $routes->post('requests',           'Api\TokenController::requestCreate');
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

    // ===== Vendor management (Phase 2/6 will revisit) =====
    $routes->group('vendors', ['filter' => 'auth'], static function ($routes) {
        $routes->get('/',                  'Api\VendorManagementController::index');
        $routes->post('/',                 'Api\VendorManagementController::create');
        $routes->patch('(:num)',           'Api\VendorManagementController::update/$1');
        $routes->post('(:num)/block',          'Api\VendorManagementController::block/$1');
        $routes->post('(:num)/unblock',        'Api\VendorManagementController::unblock/$1');
        $routes->post('(:num)/reset-password', 'Api\VendorManagementController::resetPassword/$1');
    });

    // ===== Admin (Phase 4 will rebuild payments + withdrawals admin; Phase 7 stats + exports) =====
    $routes->group('admin', ['filter' => 'auth'], static function ($routes) {
        // customers
        $routes->get('customers',                 'Api\AdminUsersController::customers');
        $routes->post('customers/(:num)/block',   'Api\AdminUsersController::block/$1');
        $routes->post('customers/(:num)/unblock', 'Api\AdminUsersController::unblock/$1');

        // categories
        $routes->get('categories',          'Api\CategoryController::adminIndex');
        $routes->post('categories',         'Api\CategoryController::create');
        $routes->patch('categories/(:num)', 'Api\CategoryController::update/$1');
        $routes->delete('categories/(:num)','Api\CategoryController::delete/$1');

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

        // current global pool balance + last 12 months of monthly_global_pools rows
        $routes->get('wallet/global-pool', 'Api\WalletController::adminGlobalPool');

        // lucky draw pools (3% slot from every order; admin picks winner)
        $routes->get('lucky-draw/pools',                       'Api\LuckyDrawController::pools');
        $routes->post('lucky-draw/pools/(:num)/pick-winner',   'Api\LuckyDrawController::pickWinner/$1');

        // blog posts (admin CRUD)
        $routes->get('blog',           'Api\BlogController::adminIndex');
        $routes->get('blog/(:num)',    'Api\BlogController::adminShow/$1');
        $routes->post('blog',          'Api\BlogController::create');
        $routes->patch('blog/(:num)',  'Api\BlogController::update/$1');
        $routes->delete('blog/(:num)', 'Api\BlogController::delete/$1');
    });
});
