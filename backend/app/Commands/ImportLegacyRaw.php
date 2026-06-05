<?php

namespace App\Commands;

use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;

/**
 * Loads the RAW legacy u290807677_epey data 1:1 into the raw legacy tables
 * created by the CreateRawLegacyTables migration.
 *
 *   php spark legacy:import-raw path/to/u290807677_epey.sql
 *
 * Unlike legacy:import (which maps old rows into the new v2 schema), this just
 * copies each legacy row verbatim into the matching raw table, preserving the
 * original primary keys so legacy foreign keys stay valid.
 *
 * Safety:
 *  - Only the 35 raw legacy tables are touched (explicit allow-list). The two
 *    names that collide with v2 (`product_variants`, `customer_wishlist`) are
 *    NOT in the list, so their INSERTs in the dump are ignored and the v2
 *    tables are never written to.
 *  - Each target table is TRUNCATEd before load, so re-runs are idempotent.
 */
class ImportLegacyRaw extends BaseCommand
{
    protected $group       = 'Legacy';
    protected $name        = 'legacy:import-raw';
    protected $description = 'Load raw legacy u290807677_epey data into the raw legacy tables (1:1).';
    protected $usage       = 'legacy:import-raw <path-to-sql>';
    protected $arguments   = ['file' => 'Path to the legacy .sql dump (with data)'];

    /** The 35 raw legacy tables we own. Anything else in the dump is skipped. */
    private const ALLOWED = [
        'banner', 'category', 'change_password', 'company', 'customer',
        'customer_cart', 'customer_review', 'delivery_person', 'district',
        'driver_km', 'driver_time', 'income', 'lucky_draw', 'notification',
        'order', 'order_details', 'otp', 'pincode', 'product', 'purchase',
        'qr_request', 'shop_category', 'state', 'subscription', 'support',
        'taluk', 'taluk_banner', 'token_profit', 'token_request', 'user',
        'variant', 'vendor', 'vendor_product', 'vendor_request', 'withdraw',
    ];

    public function run(array $params)
    {
        $path = $params[0] ?? CLI::getSegment(2) ?? null;
        if (! $path) {
            CLI::error('Usage: php spark legacy:import-raw <path-to-sql>');
            return;
        }
        if (! is_file($path)) {
            CLI::error("File not found: {$path}");
            return;
        }

        CLI::write("Reading {$path} ...", 'white');
        $tables = $this->parse(file_get_contents($path));

        $db = db_connect();
        // Tolerant mode: legacy dumps may carry '0000-00-00' dates etc.
        $db->query("SET SESSION sql_mode = ''");

        $allowed = array_fill_keys(self::ALLOWED, true);
        $total   = 0;

        $db->transBegin();
        try {
            foreach (self::ALLOWED as $t) {
                if (! $db->tableExists($t)) {
                    CLI::write("  - {$t}: table missing, skipped", 'yellow');
                    continue;
                }
                $db->table($t)->truncate();

                $rows = $tables[$t] ?? [];
                if ($rows === []) {
                    CLI::write("  - {$t}: 0 rows");
                    continue;
                }
                foreach (array_chunk($rows, 500) as $chunk) {
                    $db->table($t)->insertBatch($chunk);
                }
                $total += count($rows);
                CLI::write("  - {$t}: " . count($rows) . ' rows', 'green');
            }

            // Report any dump tables we intentionally ignored.
            foreach ($tables as $t => $rows) {
                if (! isset($allowed[$t])) {
                    CLI::write("  (skipped {$t}: " . count($rows) . ' rows — not a raw legacy table)', 'light_gray');
                }
            }

            $db->transCommit();
        } catch (\Throwable $e) {
            $db->transRollback();
            CLI::error('Import failed, rolled back: ' . $e->getMessage());
            return;
        }

        CLI::write("Done. Loaded {$total} rows into raw legacy tables.", 'green');
    }

    // ---------------------------------------------------------------------
    // Dump parser (same logic as legacy:import — handles quotes/escapes/
    // multi-tuple extended INSERTs). Returns [table => [assoc row, ...]].
    // ---------------------------------------------------------------------

    private function parse(string $sql): array
    {
        $tables = [];
        $len    = strlen($sql);
        $offset = 0;
        while (preg_match('/INSERT\s+INTO\s+`([A-Za-z0-9_]+)`\s*\(([^)]*)\)\s*VALUES/i', $sql, $m, PREG_OFFSET_CAPTURE, $offset)) {
            $table = $m[1][0];
            $cols  = array_map(static fn ($c) => trim(trim($c), " `"), explode(',', $m[2][0]));
            $i     = $m[0][1] + strlen($m[0][0]);
            $tables[$table] ??= [];

            while ($i < $len) {
                while ($i < $len && (ctype_space($sql[$i]) || $sql[$i] === ',')) { $i++; }
                if ($i >= $len || $sql[$i] === ';') { if ($i < $len) { $i++; } break; }
                if ($sql[$i] !== '(') { break; }
                $vals = $this->parseTuple($sql, $i);
                $row  = [];
                foreach ($cols as $k => $cn) { $row[$cn] = $vals[$k] ?? null; }
                $tables[$table][] = $row;
            }
            $offset = $i;
        }
        return $tables;
    }

    /** Parse one `( ... )` tuple starting at $i (which must point at '('). Advances $i past ')'. */
    private function parseTuple(string $s, int &$i): array
    {
        $i++; // skip '('
        $len  = strlen($s);
        $vals = [];
        while ($i < $len) {
            while ($i < $len && ctype_space($s[$i])) { $i++; }
            if ($i >= $len) { break; }

            if ($s[$i] === "'") {
                $i++;
                $buf = '';
                while ($i < $len) {
                    $c = $s[$i];
                    if ($c === '\\') { $buf .= $this->unescape($s[$i + 1] ?? ''); $i += 2; continue; }
                    if ($c === "'") {
                        if (($s[$i + 1] ?? '') === "'") { $buf .= "'"; $i += 2; continue; }
                        $i++; break;
                    }
                    $buf .= $c; $i++;
                }
                $vals[] = $buf;
            } else {
                $buf = '';
                while ($i < $len && $s[$i] !== ',' && $s[$i] !== ')') { $buf .= $s[$i]; $i++; }
                $buf    = trim($buf);
                $vals[] = (strtoupper($buf) === 'NULL' || $buf === '') ? null : $buf;
            }

            while ($i < $len && ctype_space($s[$i])) { $i++; }
            if ($i < $len && $s[$i] === ',') { $i++; continue; }
            if ($i < $len && $s[$i] === ')') { $i++; break; }
        }
        return $vals;
    }

    private function unescape(string $c): string
    {
        return match ($c) {
            'n'     => "\n",
            'r'     => "\r",
            't'     => "\t",
            '0'     => "\0",
            'Z'     => chr(26),
            '\\'    => '\\',
            "'"     => "'",
            '"'     => '"',
            default => $c,
        };
    }
}
