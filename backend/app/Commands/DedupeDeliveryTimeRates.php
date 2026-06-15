<?php

namespace App\Commands;

use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;
use Config\Database;

/**
 * Legacy import created many duplicate delivery_time_rates rows for the same
 * (taluk_id, time_min). Keep the latest (MAX id) per group and delete the rest,
 * so each taluk+time has exactly one rate. Dry-run by default; pass --apply.
 */
class DedupeDeliveryTimeRates extends BaseCommand
{
    protected $group       = 'Maintenance';
    protected $name        = 'delivery-rates:dedupe-time';
    protected $description  = 'Keep one delivery_time_rates row per (taluk_id, time_min) — the latest — delete duplicates.';

    public function run(array $params)
    {
        // Accept either the positional token `apply` or the `--apply` option.
        $apply = in_array('apply', $params, true) || CLI::getOption('apply') !== null;
        $db    = Database::connect();

        $rows = $db->query(
            'SELECT t.id
             FROM delivery_time_rates t
             JOIN (
                SELECT taluk_id, time_min, MAX(id) AS keep_id, COUNT(*) AS c
                FROM delivery_time_rates
                GROUP BY taluk_id, time_min
                HAVING c > 1
             ) g ON g.taluk_id = t.taluk_id AND g.time_min = t.time_min AND t.id <> g.keep_id'
        )->getResultArray();
        $ids = array_map(static fn ($r) => (int) $r['id'], $rows);

        CLI::write('Duplicate rows to remove: ' . count($ids));
        if (! $apply) {
            CLI::write('Dry run — re-run as `spark delivery-rates:dedupe-time apply` to delete.', 'yellow');
            return;
        }
        if ($ids) {
            $db->table('delivery_time_rates')->whereIn('id', $ids)->delete();
            CLI::write('Deleted ' . count($ids) . ' duplicate rows. Each taluk+time now has one rate.', 'green');
        } else {
            CLI::write('No duplicates found.', 'green');
        }
    }
}
