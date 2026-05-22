<?php

namespace App\Controllers\Api;

use CodeIgniter\HTTP\ResponseInterface;
use Config\Database;

/**
 * Admin activity log — virtual feed merged from existing tables.
 *
 * Sources:
 *   users (signups), referrals (bonus payouts), wallet_transactions (money movements).
 *
 * No activity_logs table exists; this aggregates in MySQL via UNION ALL so the
 * shape stays cheap to add to without changing controllers that mutate state.
 *
 * GET /api/v1/admin/activity
 *   ?from=YYYY-MM-DD   start date (inclusive)
 *   ?to=YYYY-MM-DD     end date (inclusive)
 *   ?actor=<string>    case-insensitive substring of actor name OR mobile
 *   ?role=<role>       only entries where the actor has this role
 *   ?source=signup|referral|wallet
 *   ?page=1 &per_page=50
 */
class ActivityController extends BaseApiController
{
    public function index(): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;

        $from   = (string) ($this->request->getGet('from')   ?? '');
        $to     = (string) ($this->request->getGet('to')     ?? '');
        $actor  = trim((string) ($this->request->getGet('actor') ?? ''));
        $role   = (string) ($this->request->getGet('role')   ?? '');
        $source = (string) ($this->request->getGet('source') ?? '');
        $p      = $this->paging(50);

        $db = Database::connect();
        $bindings = [];
        $unions   = [];

        if ($source === '' || $source === 'signup') {
            $unions[] = "
                SELECT 'signup' AS source,
                       u.id    AS event_id,
                       u.id    AS actor_id,
                       u.name  AS actor_name,
                       u.mobile_number AS actor_mobile,
                       u.role  AS actor_role,
                       CONCAT('Joined as ', u.role) AS title,
                       NULL AS amount,
                       u.created_at AS created_at
                FROM users u
                WHERE u.deleted_at IS NULL
            ";
        }

        if ($source === '' || $source === 'referral') {
            $unions[] = "
                SELECT 'referral' AS source,
                       r.id      AS event_id,
                       u.id      AS actor_id,
                       u.name    AS actor_name,
                       u.mobile_number AS actor_mobile,
                       u.role    AS actor_role,
                       CONCAT('Referral bonus L', r.level, ' for ', COALESCE(ref.name, '—')) AS title,
                       r.bonus_amount AS amount,
                       r.created_at AS created_at
                FROM referrals r
                JOIN users u   ON u.id = r.referrer_id
                LEFT JOIN users ref ON ref.id = r.referred_id
            ";
        }

        if ($source === '' || $source === 'wallet') {
            $unions[] = "
                SELECT 'wallet' AS source,
                       wt.id    AS event_id,
                       u.id     AS actor_id,
                       u.name   AS actor_name,
                       u.mobile_number AS actor_mobile,
                       u.role   AS actor_role,
                       CONCAT(UPPER(LEFT(wt.type,1)), SUBSTRING(wt.type,2),
                              CASE WHEN wt.notes IS NOT NULL AND wt.notes <> '' THEN CONCAT(' — ', wt.notes) ELSE '' END) AS title,
                       wt.amount AS amount,
                       wt.created_at AS created_at
                FROM wallet_transactions wt
                JOIN users u ON u.id = wt.user_id
            ";
        }

        if (empty($unions)) {
            return $this->ok(['items' => [], 'total' => 0, 'page' => $p['page'], 'per_page' => $p['perPage']]);
        }

        // Stitch UNION ALL into a derived table so filters apply uniformly.
        $inner = '(' . implode(' UNION ALL ', $unions) . ') AS feed';

        $where  = [];
        if ($from !== '') { $where[] = 'feed.created_at >= ?';                  $bindings[] = $from . ' 00:00:00'; }
        if ($to   !== '') { $where[] = 'feed.created_at <= ?';                  $bindings[] = $to   . ' 23:59:59'; }
        if ($role !== '') { $where[] = 'feed.actor_role = ?';                   $bindings[] = $role; }
        if ($actor !== ''){ $where[] = '(feed.actor_name LIKE ? OR feed.actor_mobile LIKE ?)';
                            $bindings[] = "%{$actor}%"; $bindings[] = "%{$actor}%"; }

        $whereSql = $where ? ' WHERE ' . implode(' AND ', $where) : '';

        $countSql = "SELECT COUNT(*) AS n FROM {$inner}{$whereSql}";
        $total    = (int) ($db->query($countSql, $bindings)->getRow('n') ?? 0);

        $pageSql = "SELECT * FROM {$inner}{$whereSql} ORDER BY feed.created_at DESC LIMIT {$p['perPage']} OFFSET {$p['offset']}";
        $rows    = $db->query($pageSql, $bindings)->getResultArray();

        $items = array_map(static function ($r) {
            return [
                'source'       => $r['source'],
                'event_id'     => (int) $r['event_id'],
                'actor_id'     => (int) $r['actor_id'],
                'actor_name'   => $r['actor_name'],
                'actor_mobile' => $r['actor_mobile'],
                'actor_role'   => $r['actor_role'],
                'title'        => $r['title'],
                'amount'       => $r['amount'] !== null ? (float) $r['amount'] : null,
                'created_at'   => $r['created_at'],
            ];
        }, $rows);

        return $this->ok([
            'items'    => $items,
            'total'    => $total,
            'page'     => $p['page'],
            'per_page' => $p['perPage'],
        ]);
    }

    /**
     * Personal feed for the logged-in user — same shape as index() but scoped to
     * own wallet movements, referral bonuses earned, and notifications received.
     *
     * GET /api/v1/activity/mine
     *   ?source=wallet|referral|notification
     *   ?page=1 &per_page=50
     */
    public function mine(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);

        $source = (string) ($this->request->getGet('source') ?? '');
        $p      = $this->paging(50);

        $db = Database::connect();
        $bindings = [];
        $unions   = [];
        $uid      = (int) $auth->id;

        if ($source === '' || $source === 'wallet') {
            $unions[] = "
                SELECT 'wallet' AS source,
                       wt.id   AS event_id,
                       CONCAT(UPPER(LEFT(wt.type,1)), SUBSTRING(wt.type,2),
                              CASE WHEN wt.notes IS NOT NULL AND wt.notes <> '' THEN CONCAT(' — ', wt.notes) ELSE '' END) AS title,
                       wt.amount AS amount,
                       wt.created_at AS created_at
                FROM wallet_transactions wt
                WHERE wt.user_id = ?
            ";
            $bindings[] = $uid;
        }

        if ($source === '' || $source === 'referral') {
            $unions[] = "
                SELECT 'referral' AS source,
                       r.id      AS event_id,
                       CONCAT('Referral bonus L', r.level, ' for ', COALESCE(ref.name, '—')) AS title,
                       r.bonus_amount AS amount,
                       r.created_at AS created_at
                FROM referrals r
                LEFT JOIN users ref ON ref.id = r.referred_id
                WHERE r.referrer_id = ?
            ";
            $bindings[] = $uid;
        }

        if ($source === '' || $source === 'notification') {
            $unions[] = "
                SELECT 'notification' AS source,
                       n.id   AS event_id,
                       CONCAT(COALESCE(n.title, 'Notification'),
                              CASE WHEN n.body IS NOT NULL AND n.body <> '' THEN CONCAT(' — ', n.body) ELSE '' END) AS title,
                       NULL   AS amount,
                       n.created_at AS created_at
                FROM notifications n
                WHERE n.user_id = ?
            ";
            $bindings[] = $uid;
        }

        if (empty($unions)) {
            return $this->ok(['items' => [], 'total' => 0, 'page' => $p['page'], 'per_page' => $p['perPage']]);
        }

        $inner = '(' . implode(' UNION ALL ', $unions) . ') AS feed';

        $countSql = "SELECT COUNT(*) AS n FROM {$inner}";
        $total    = (int) ($db->query($countSql, $bindings)->getRow('n') ?? 0);

        $pageSql = "SELECT * FROM {$inner} ORDER BY feed.created_at DESC LIMIT {$p['perPage']} OFFSET {$p['offset']}";
        $rows    = $db->query($pageSql, $bindings)->getResultArray();

        $items = array_map(static function ($r) {
            return [
                'source'     => $r['source'],
                'event_id'   => (int) $r['event_id'],
                'title'      => $r['title'],
                'amount'     => $r['amount'] !== null ? (float) $r['amount'] : null,
                'created_at' => $r['created_at'],
            ];
        }, $rows);

        return $this->ok([
            'items'    => $items,
            'total'    => $total,
            'page'     => $p['page'],
            'per_page' => $p['perPage'],
        ]);
    }

    private function requireAdmin(): ?ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth)                  return $this->fail('Unauthorized', 401);
        if ($auth->role !== 'admin')  return $this->fail('Forbidden', 403);
        return null;
    }
}
