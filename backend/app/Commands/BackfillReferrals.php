<?php

namespace App\Commands;

use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;

/**
 * One-time backfill for migrated users.
 *
 *   php spark legacy:backfill-referrals
 *
 * legacy:import set users.referrer_id but never ran the per-signup bookkeeping
 * that AuthController::bumpUplineLevelCounts() does, so migrated users have
 * level_1/2/3_count = 0 and the referrals table is empty.
 *
 * The graph is built from the LEGACY `customer.reffered_by` table (the
 * authoritative referral tree from the old site), not v2 users.referrer_id —
 * a handful of referrer_id links were dropped during import, so counting from
 * them under-reports. Legacy customer ids are mapped to v2 user ids via
 * legacy_id_map, so counts land on the right users and match the legacy dump
 * exactly.
 *
 * For every legacy customer it mirrors signup across its up-to-3 ancestors:
 *   - increments the ancestor's level_{1,2,3}_count, and
 *   - inserts a referrals row (referrer_id, referred_id, level, bonus_amount).
 *
 * Safe and idempotent: counts are reset and the referrals table truncated
 * before the rebuild. bonus_amount is the legacy join_level config (display
 * only) — wallet balances were imported as-is and are not touched here.
 */
class BackfillReferrals extends BaseCommand
{
    protected $group       = 'Legacy';
    protected $name        = 'legacy:backfill-referrals';
    protected $description = 'Recompute level_1/2/3_count and rebuild the referrals table from referrer_id.';

    public function run(array $params)
    {
        $db  = db_connect();
        $now = date('Y-m-d H:i:s');

        // Per-level referral (join) bonus, taken from the legacy token_profit
        // config (join_level_1/2/3). Used only for display in the activity feed;
        // wallet balances are imported as-is and are not touched here.
        $bonusByLevel = [1 => 15.0, 2 => 10.0, 3 => 5.0];
        if ($db->tableExists('token_profit')) {
            $cfg = $db->table('token_profit')->select('join_level_1, join_level_2, join_level_3')->get()->getRowArray();
            if ($cfg) {
                $bonusByLevel = [
                    1 => (float) $cfg['join_level_1'],
                    2 => (float) $cfg['join_level_2'],
                    3 => (float) $cfg['join_level_3'],
                ];
            }
        }
        CLI::write('Referral bonus per level: L1=' . $bonusByLevel[1] . ', L2=' . $bonusByLevel[2] . ', L3=' . $bonusByLevel[3], 'white');

        if (! $db->tableExists('customer') || ! $db->tableExists('legacy_id_map')) {
            CLI::error('Raw legacy `customer` / `legacy_id_map` table missing — run legacy:import-raw first.');
            return;
        }

        CLI::write('Loading legacy customer graph ...', 'white');

        // legacy customer id -> v2 user id
        $toUser = [];
        foreach ($db->table('legacy_id_map')->where('old_table', 'customer')->get()->getResultArray() as $r) {
            $toUser[(int) $r['old_id']] = (int) $r['new_id'];
        }

        $rows = $db->table('customer')->select('id, reffered_by, created_on')->get()->getResultArray();

        $referrer  = [];   // legacy id => legacy reffered_by (0 if none)
        $exists    = [];   // legacy id => true
        $createdAt = [];   // legacy id => created_on
        foreach ($rows as $r) {
            $id             = (int) $r['id'];
            $referrer[$id]  = (int) ($r['reffered_by'] ?? 0);
            $exists[$id]    = true;
            $createdAt[$id] = $r['created_on'] ?: $now;
        }

        // For every legacy customer, walk up to 3 ancestors and credit each one.
        // Counts are stored on the ancestor's v2 user; a referrals row needs both
        // ends mapped to v2 users (de-duped on the referrals unique key).
        $counts  = [];   // counts[v2AncestorId][level] = n
        $edges   = [];
        $seen    = [];   // "referrer:referred" guard for the unique key
        foreach ($referrer as $cid => $_) {
            $cur   = $referrer[$cid];
            $level = 1;
            while ($level <= 3 && $cur > 0 && isset($exists[$cur])) {
                $ancestor = $toUser[$cur] ?? 0;
                if ($ancestor > 0) {
                    $counts[$ancestor][$level] = ($counts[$ancestor][$level] ?? 0) + 1;
                    $referred = $toUser[$cid] ?? 0;
                    $key      = $ancestor . ':' . $referred;
                    if ($referred > 0 && ! isset($seen[$key])) {
                        $seen[$key] = true;
                        $edges[] = [
                            'referrer_id'  => $ancestor,
                            'referred_id'  => $referred,
                            'level'        => $level,
                            'bonus_amount' => $bonusByLevel[$level] ?? 0,
                            'created_at'   => $createdAt[$cid],
                        ];
                    }
                }
                $cur = $referrer[$cur] ?? 0;
                $level++;
            }
        }

        CLI::write('Ancestors with downline: ' . count($counts) . ', referral edges: ' . count($edges), 'white');

        $db->transBegin();
        try {
            // 1) Reset every user's counts, then write the computed ones.
            $db->query('UPDATE `users` SET `level_1_count` = 0, `level_2_count` = 0, `level_3_count` = 0');

            $updates = [];
            foreach ($counts as $id => $c) {
                $updates[] = [
                    'id'            => $id,
                    'level_1_count' => (int) ($c[1] ?? 0),
                    'level_2_count' => (int) ($c[2] ?? 0),
                    'level_3_count' => (int) ($c[3] ?? 0),
                ];
            }
            foreach (array_chunk($updates, 500) as $chunk) {
                $db->table('users')->updateBatch($chunk, 'id');
            }

            // 2) Rebuild the referrals table.
            $db->table('referrals')->truncate();
            foreach (array_chunk($edges, 1000) as $chunk) {
                $db->table('referrals')->insertBatch($chunk);
            }

            $db->transCommit();
        } catch (\Throwable $e) {
            $db->transRollback();
            CLI::error('Backfill failed, rolled back: ' . $e->getMessage());
            return;
        }

        CLI::write('Done. Updated ' . count($counts) . ' users, inserted ' . count($edges) . ' referral rows.', 'green');
    }
}
