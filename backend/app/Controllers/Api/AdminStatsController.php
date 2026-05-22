<?php

namespace App\Controllers\Api;

use Config\Database;
use CodeIgniter\HTTP\ResponseInterface;

class AdminStatsController extends BaseApiController
{
    public function summary(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth || $auth->role !== 'admin') return $this->fail('Forbidden', 403);

        $db = Database::connect();

        $row = $db->query('SELECT COUNT(*) c FROM users WHERE role="customer"')->getRow();
        $customers = (int) $row->c;
        $vendors   = (int) $db->query('SELECT COUNT(*) c FROM users WHERE role="vendor"')->getRow()->c;
        $orders    = (int) $db->query('SELECT COUNT(*) c FROM orders')->getRow()->c;
        $revenue   = (float) ($db->query('SELECT COALESCE(SUM(total),0) s FROM orders WHERE status IN ("paid","shipped","delivered")')->getRow()->s ?? 0);
        $pendingP  = (int) $db->query('SELECT COUNT(*) c FROM payments WHERE status="pending"')->getRow()->c;
        $pendingW  = (int) $db->query('SELECT COUNT(*) c FROM withdrawals WHERE status="pending"')->getRow()->c;
        $pendingS  = (int) $db->query('SELECT COUNT(*) c FROM support_tickets WHERE status="open"')->getRow()->c;

        // Last 14 days orders + revenue
        $since = date('Y-m-d', strtotime('-13 days'));
        $rows = $db->query(
            'SELECT DATE(created_at) d, COUNT(*) orders, COALESCE(SUM(total),0) revenue
             FROM orders WHERE DATE(created_at) >= ? GROUP BY DATE(created_at)',
            [$since]
        )->getResultArray();
        $byDay = [];
        foreach ($rows as $r) $byDay[$r['d']] = ['orders' => (int) $r['orders'], 'revenue' => (float) $r['revenue']];
        $series = [];
        for ($i = 13; $i >= 0; $i--) {
            $d = date('Y-m-d', strtotime("-{$i} days"));
            $series[] = ['date' => $d, 'orders' => $byDay[$d]['orders'] ?? 0, 'revenue' => $byDay[$d]['revenue'] ?? 0];
        }

        // Customers by month (last 6 months)
        $rows2 = $db->query(
            'SELECT DATE_FORMAT(created_at, "%Y-%m") m, COUNT(*) c
             FROM users WHERE role="customer" AND created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
             GROUP BY DATE_FORMAT(created_at, "%Y-%m")'
        )->getResultArray();
        $byMonth = [];
        foreach ($rows2 as $r) $byMonth[$r['m']] = (int) $r['c'];
        $custSeries = [];
        for ($i = 5; $i >= 0; $i--) {
            $m = date('Y-m', strtotime("-{$i} months"));
            $custSeries[] = ['month' => $m, 'count' => $byMonth[$m] ?? 0];
        }

        return $this->ok([
            'totals' => [
                'customers' => $customers,
                'vendors'   => $vendors,
                'orders'    => $orders,
                'revenue'   => $revenue,
                'pending_payments'    => $pendingP,
                'pending_withdrawals' => $pendingW,
                'pending_support'     => $pendingS,
            ],
            'orders_series'    => $series,
            'customers_series' => $custSeries,
        ]);
    }

    /**
     * One-call dashboard payload — replaces the staff-app mock layer for admin.
     * Returns counters + 14-day orders series + top categories by revenue +
     * recent orders + latest vendors.
     */
    public function dashboard(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth || $auth->role !== 'admin') return $this->fail('Forbidden', 403);

        $db    = Database::connect();
        $today = date('Y-m-d');

        // Counters
        $customers = (int) $db->query('SELECT COUNT(*) c FROM users WHERE role="customer" AND deleted_at IS NULL')->getRow()->c;
        $vendors   = (int) $db->query('SELECT COUNT(*) c FROM users WHERE role="vendor" AND deleted_at IS NULL')->getRow()->c;
        $todaysOrders  = (int) $db->query('SELECT COUNT(*) c FROM orders WHERE DATE(created_at) = ?', [$today])->getRow()->c;
        $todaysRevenue = (float) ($db->query(
            'SELECT COALESCE(SUM(total),0) s FROM orders WHERE DATE(created_at) = ? AND status IN ("paid","shipped","delivered")',
            [$today]
        )->getRow()->s ?? 0);
        // payments + withdrawals tables aren't part of V2 scope yet — return 0 if missing.
        $hasPayments    = $db->tableExists('payments');
        $hasWithdrawals = $db->tableExists('withdrawals');
        $pendingP = $hasPayments    ? (int) $db->query('SELECT COUNT(*) c FROM payments WHERE status="pending"')->getRow()->c    : 0;
        $pendingW = $hasWithdrawals ? (int) $db->query('SELECT COUNT(*) c FROM withdrawals WHERE status="pending"')->getRow()->c : 0;

        // 14-day orders + revenue series, padded with zero days so the chart has
        // continuous x-axis even when there are no orders for a given date.
        $since = date('Y-m-d', strtotime('-13 days'));
        $rows  = $db->query(
            'SELECT DATE(created_at) d, COUNT(*) orders, COALESCE(SUM(total),0) revenue
             FROM orders WHERE DATE(created_at) >= ? GROUP BY DATE(created_at)',
            [$since]
        )->getResultArray();
        $byDay = [];
        foreach ($rows as $r) $byDay[$r['d']] = ['orders' => (int) $r['orders'], 'revenue' => (float) $r['revenue']];
        $series = [];
        for ($i = 13; $i >= 0; $i--) {
            $d = date('Y-m-d', strtotime("-{$i} days"));
            $series[] = [
                'date'    => $d,
                'orders'  => $byDay[$d]['orders']  ?? 0,
                'revenue' => $byDay[$d]['revenue'] ?? 0,
            ];
        }

        // Top categories by revenue (order_items → products → categories)
        $catRows = $db->query(
            'SELECT c.id, c.name, COALESCE(SUM(oi.subtotal),0) revenue, COUNT(DISTINCT oi.order_id) orders
             FROM order_items oi
             JOIN orders   o ON o.id = oi.order_id AND o.status IN ("paid","shipped","delivered")
             JOIN products p ON p.id = oi.product_id
             JOIN categories c ON c.id = p.category_id
             GROUP BY c.id, c.name
             ORDER BY revenue DESC
             LIMIT 5'
        )->getResultArray();
        $topCategories = array_map(static fn ($r) => [
            'id'      => (int) $r['id'],
            'name'    => $r['name'],
            'revenue' => (float) $r['revenue'],
            'orders'  => (int) $r['orders'],
        ], $catRows);

        // Recent orders (latest 8) with customer + vendor names resolved.
        $recentRows = $db->query(
            'SELECT o.id, o.total, o.status, o.created_at,
                    cu.name AS customer_name, ve.name AS vendor_name,
                    vp.shop_name AS shop_name
             FROM orders o
             LEFT JOIN users cu ON cu.id = o.customer_id
             LEFT JOIN users ve ON ve.id = o.vendor_id
             LEFT JOIN vendor_profiles vp ON vp.user_id = o.vendor_id
             ORDER BY o.id DESC
             LIMIT 8'
        )->getResultArray();
        $recentOrders = array_map(static fn ($r) => [
            'id'         => (int) $r['id'],
            'customer'   => $r['customer_name'] ?? '—',
            'vendor'     => $r['shop_name'] ?: ($r['vendor_name'] ?? '—'),
            'total'      => (float) $r['total'],
            'status'     => (string) $r['status'],
            'created_at' => $r['created_at'],
        ], $recentRows);

        // Latest 5 vendors with shop name + category.
        $vendorRows = $db->query(
            'SELECT u.id, u.name, u.created_at, u.status,
                    vp.shop_name, vp.image, vc.name AS category_name
             FROM users u
             LEFT JOIN vendor_profiles vp ON vp.user_id = u.id
             LEFT JOIN vendor_categories vc ON vc.id = vp.vendor_category_id
             WHERE u.role = "vendor" AND u.deleted_at IS NULL
             ORDER BY u.id DESC
             LIMIT 5'
        )->getResultArray();
        $latestVendors = array_map(static fn ($r) => [
            'id'         => (int) $r['id'],
            'name'       => $r['shop_name'] ?: $r['name'],
            'category'   => $r['category_name'] ?? null,
            'image'      => $r['image'] ?? null,
            'status'     => (string) ($r['status'] ?? 'active'),
            'created_at' => $r['created_at'],
        ], $vendorRows);

        return $this->ok([
            'totals' => [
                'customers'           => $customers,
                'vendors'             => $vendors,
                'todays_orders'       => $todaysOrders,
                'todays_revenue'      => $todaysRevenue,
                'pending_payments'    => $pendingP,
                'pending_withdrawals' => $pendingW,
            ],
            'orders_series'  => $series,
            'top_categories' => $topCategories,
            'recent_orders'  => $recentOrders,
            'latest_vendors' => $latestVendors,
        ]);
    }

    /**
     * Per-staff dashboard for taluk / district / state.
     * Counters: tokens_issued (peer in wallet_transactions), tokens_received,
     * wallet, team_below (geo rows under my user_id).
     * Chart: 14-day count of wallet_transactions touching me.
     * Activity: latest peers I've transacted with, summed.
     *
     * If the geo→user_id mapping isn't seeded (NULL), team_below = 0.
     */
    public function staffDashboard(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth || ! in_array($auth->role, ['taluk', 'district', 'state'], true)) return $this->fail('Forbidden', 403);

        $db  = Database::connect();
        $uid = (int) $auth->id;

        // Wallet from users. Token balance computed: Σ tokens received from
        // the immediately-above role's approvals. Pass-throughs to lower
        // levels don't reduce this displayed value — that's the "from-above
        // approval ledger" view the dashboard surfaces.
        $wallet = (float) ($db->query('SELECT wallet_balance FROM users WHERE id = ?', [$uid])->getRow()->wallet_balance ?? 0);

        $aboveRole = match ($auth->role) {
            'taluk'    => 'district',
            'district' => 'state',
            'state'    => 'admin',
            default    => null,
        };
        $tokenBalance = 0;
        if ($aboveRole) {
            $tokenBalance = (int) ($db->query(
                'SELECT COALESCE(SUM(dt.tokens),0) s
                 FROM distribute_tokens dt
                 JOIN users u ON u.id = dt.from_user_id
                 WHERE dt.to_user_id = ? AND u.role = ?',
                [$uid, $aboveRole]
            )->getRow()->s ?? 0);
        }

        // Token movement comes from the distribute_tokens ledger (the real
        // source of truth — wallet_transactions doesn't track token flow).
        $tokensReceived = (int) ($db->query(
            'SELECT COALESCE(SUM(tokens),0) s FROM distribute_tokens WHERE to_user_id = ?',
            [$uid]
        )->getRow()->s ?? 0);
        $tokensIssued = (int) ($db->query(
            'SELECT COALESCE(SUM(tokens),0) s FROM distribute_tokens WHERE from_user_id = ?',
            [$uid]
        )->getRow()->s ?? 0);

        // Team below — chain depends on role. If staff user isn't mapped to a
        // geo row yet, every count returns 0 (honest empty state).
        $teamBelow = 0;
        $topRows   = [];
        if ($auth->role === 'taluk') {
            $myTalukIds = $db->query('SELECT id FROM taluks WHERE user_id = ? AND status = "active"', [$uid])->getResultArray();
            $ids = array_map(static fn ($r) => (int) $r['id'], $myTalukIds);
            if ($ids) {
                $in = '(' . implode(',', $ids) . ')';
                $teamBelow = (int) $db->query("SELECT COUNT(*) c FROM vendor_profiles WHERE taluk_id IN $in")->getRow()->c;
                $topRows = $db->query(
                    "SELECT u.id, COALESCE(vp.shop_name, u.name) AS name, u.mobile_number AS mobile
                     FROM vendor_profiles vp
                     JOIN users u ON u.id = vp.user_id
                     WHERE vp.taluk_id IN $in AND u.role = 'vendor' AND u.deleted_at IS NULL
                     ORDER BY u.id DESC
                     LIMIT 5"
                )->getResultArray();
            }
        } elseif ($auth->role === 'district') {
            $myDistrictIds = $db->query('SELECT id FROM districts WHERE user_id = ? AND status = "active"', [$uid])->getResultArray();
            $ids = array_map(static fn ($r) => (int) $r['id'], $myDistrictIds);
            if ($ids) {
                $in = '(' . implode(',', $ids) . ')';
                $teamBelow = (int) $db->query("SELECT COUNT(*) c FROM taluks WHERE district_id IN $in")->getRow()->c;
                $topRows = $db->query(
                    "SELECT t.id, t.name, u.mobile_number AS mobile
                     FROM taluks t
                     LEFT JOIN users u ON u.id = t.user_id
                     WHERE t.district_id IN $in AND t.status = 'active'
                     ORDER BY t.id DESC
                     LIMIT 5"
                )->getResultArray();
            }
        } else { // state
            $myStateIds = $db->query('SELECT id FROM states WHERE user_id = ? AND status = "active"', [$uid])->getResultArray();
            $ids = array_map(static fn ($r) => (int) $r['id'], $myStateIds);
            if ($ids) {
                $in = '(' . implode(',', $ids) . ')';
                $teamBelow = (int) $db->query("SELECT COUNT(*) c FROM districts WHERE state_id IN $in")->getRow()->c;
                $topRows = $db->query(
                    "SELECT d.id, d.name, u.mobile_number AS mobile
                     FROM districts d
                     LEFT JOIN users u ON u.id = d.user_id
                     WHERE d.state_id IN $in AND d.status = 'active'
                     ORDER BY d.id DESC
                     LIMIT 5"
                )->getResultArray();
            }
        }

        // 14-day distribute_tokens count touching me (either side). Uses the
        // real token-flow ledger; wallet_transactions doesn't see token moves.
        $since = date('Y-m-d', strtotime('-13 days'));
        $rows  = $db->query(
            'SELECT DATE(created_at) d, COUNT(*) n, COALESCE(SUM(tokens),0) v
             FROM distribute_tokens
             WHERE (to_user_id = ? OR from_user_id = ?) AND DATE(created_at) >= ?
             GROUP BY DATE(created_at)',
            [$uid, $uid, $since]
        )->getResultArray();
        $byDay = [];
        foreach ($rows as $r) $byDay[$r['d']] = ['count' => (int) $r['n'], 'value' => (float) $r['v']];
        $series = [];
        for ($i = 13; $i >= 0; $i--) {
            $d = date('Y-m-d', strtotime("-{$i} days"));
            $series[] = [
                'date'  => $d,
                'count' => $byDay[$d]['count'] ?? 0,
                'value' => $byDay[$d]['value'] ?? 0,
            ];
        }

        $top = array_map(static fn ($r) => [
            'id'     => (int) $r['id'],
            'name'   => $r['name'] ?? '—',
            'mobile' => $r['mobile'] ?? null,
        ], $topRows);

        return $this->ok([
            'role'   => $auth->role,
            'totals' => [
                'tokens_issued'   => $tokensIssued,
                'tokens_received' => $tokensReceived,
                'token_balance'   => $tokenBalance,
                'wallet'          => $wallet,
                'team_below'      => $teamBelow,
            ],
            'series' => $series,
            'top'    => $top,
        ]);
    }

    /**
     * Per-vendor dashboard. Same one-call shape as admin so the frontend
     * can render Today's orders / Active products / Token balance / Wallet
     * tiles + 14-day orders chart + recent orders for the logged-in vendor.
     */
    public function vendorDashboard(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth || $auth->role !== 'vendor') return $this->fail('Forbidden', 403);

        $db    = Database::connect();
        $vid   = (int) $auth->id;
        $today = date('Y-m-d');

        // Counters
        $todaysOrders   = (int) $db->query('SELECT COUNT(*) c FROM orders WHERE vendor_id = ? AND DATE(created_at) = ?', [$vid, $today])->getRow()->c;
        $activeProducts = (int) $db->query('SELECT COUNT(*) c FROM products WHERE vendor_id = ? AND status = "active" AND deleted_at IS NULL', [$vid])->getRow()->c;

        // wallet_balance lives on users; token_balance for the widget is
        // computed: Σ tokens received from taluk users − Σ consumption from
        // customer orders. (Direct admin distributions or chain transfers
        // from non-taluk senders don't count toward the displayed balance.)
        $wallet = (float) ($db->query('SELECT wallet_balance FROM users WHERE id = ?', [$vid])->getRow()->wallet_balance ?? 0);

        $receivedFromTaluk = (int) ($db->query(
            'SELECT COALESCE(SUM(dt.tokens),0) s
             FROM distribute_tokens dt
             JOIN users u ON u.id = dt.from_user_id
             WHERE dt.to_user_id = ? AND u.role = "taluk"',
            [$vid]
        )->getRow()->s ?? 0);

        // Tokens consumed per order = order.total × vendor.commission_pct / 100.
        // (1 token = ₹1, same formula as TokenService::consumeForOrder.)
        $commissionPct = (float) ($db->query(
            'SELECT commission_pct FROM vendor_profiles WHERE user_id = ?',
            [$vid]
        )->getRow()->commission_pct ?? 10.0);

        $orderTotalSum = (float) ($db->query(
            'SELECT COALESCE(SUM(total),0) s FROM orders WHERE vendor_id = ?',
            [$vid]
        )->getRow()->s ?? 0);
        $consumedByOrders = (int) round($orderTotalSum * $commissionPct / 100);

        $tokenBalance = max(0, $receivedFromTaluk - $consumedByOrders);

        // 14-day orders series (vendor-scoped), zero-filled.
        $since = date('Y-m-d', strtotime('-13 days'));
        $rows  = $db->query(
            'SELECT DATE(created_at) d, COUNT(*) orders, COALESCE(SUM(total),0) revenue
             FROM orders WHERE vendor_id = ? AND DATE(created_at) >= ?
             GROUP BY DATE(created_at)',
            [$vid, $since]
        )->getResultArray();
        $byDay = [];
        foreach ($rows as $r) $byDay[$r['d']] = ['orders' => (int) $r['orders'], 'revenue' => (float) $r['revenue']];
        $series = [];
        for ($i = 13; $i >= 0; $i--) {
            $d = date('Y-m-d', strtotime("-{$i} days"));
            $series[] = [
                'date'    => $d,
                'orders'  => $byDay[$d]['orders']  ?? 0,
                'revenue' => $byDay[$d]['revenue'] ?? 0,
            ];
        }

        // Recent orders for this vendor with customer name + line-item count.
        $recentRows = $db->query(
            'SELECT o.id, o.total, o.status, o.created_at, cu.name AS customer_name,
                    (SELECT COALESCE(SUM(qty),0) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
             FROM orders o
             LEFT JOIN users cu ON cu.id = o.customer_id
             WHERE o.vendor_id = ?
             ORDER BY o.id DESC
             LIMIT 8',
            [$vid]
        )->getResultArray();
        $recentOrders = array_map(static fn ($r) => [
            'id'         => (int) $r['id'],
            'customer'   => $r['customer_name'] ?? '—',
            'items'      => (int) $r['item_count'],
            'total'      => (float) $r['total'],
            'status'     => (string) $r['status'],
            'created_at' => $r['created_at'],
        ], $recentRows);

        return $this->ok([
            'totals' => [
                'todays_orders'   => $todaysOrders,
                'active_products' => $activeProducts,
                'token_balance'   => $tokenBalance,
                'wallet'          => $wallet,
            ],
            'orders_series' => $series,
            'recent_orders' => $recentOrders,
        ]);
    }
}
