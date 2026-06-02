<?php

namespace App\Commands;

use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;

/**
 * Apply real staff (state/district/taluk) mobile numbers from a filled CSV.
 *
 *   php spark legacy:apply-staff-mobiles path/to/staff_mobiles.csv
 *
 * The old database had no phone numbers for most geo staff (it stored serial
 * codes like "02.0000000"). This command takes a CSV — typically the
 * staff_mobiles_to_fill.csv template — and writes the real numbers in.
 *
 * Expected CSV header (case-insensitive). Either legacy_id OR (role + name) is
 * required to locate the staff row; new_mobile holds the number to set:
 *   legacy_id, role, name, current_mobile, new_mobile
 *
 * Matching is by legacy_id (old `user`.id via legacy_id_map) when present —
 * unambiguous even when two places share a name — otherwise by role + name.
 * A number is only written when it stays unique within that role.
 */
class ApplyStaffMobiles extends BaseCommand
{
    protected $group       = 'Legacy';
    protected $name        = 'legacy:apply-staff-mobiles';
    protected $description = 'Apply real staff mobile numbers from a filled CSV.';
    protected $usage       = 'legacy:apply-staff-mobiles <csv>';
    protected $arguments   = ['file' => 'Path to the filled CSV'];

    public function run(array $params)
    {
        $path = $params[0] ?? CLI::getSegment(2) ?? null;
        if (! $path || ! is_file($path)) {
            CLI::error('Usage: php spark legacy:apply-staff-mobiles <csv>');
            return;
        }

        $fh = fopen($path, 'r');
        if (! $fh) { CLI::error("Could not open {$path}"); return; }

        $header = fgetcsv($fh);
        if (! $header) { CLI::error('Empty CSV.'); fclose($fh); return; }
        $idx = [];
        foreach ($header as $i => $h) { $idx[strtolower(trim($h))] = $i; }
        if (! isset($idx['new_mobile'])) {
            CLI::error("CSV needs a 'new_mobile' column. Found: " . implode(', ', $header));
            fclose($fh);
            return;
        }

        $db      = db_connect();
        $applied = 0; $skipped = 0;

        while (($row = fgetcsv($fh)) !== false) {
            $newMobile = $this->normalize($row[$idx['new_mobile']] ?? '');
            if ($newMobile === '') { continue; } // blank = nothing to set

            $legacyId = isset($idx['legacy_id']) ? trim((string) ($row[$idx['legacy_id']] ?? '')) : '';
            $role     = isset($idx['role']) ? strtolower(trim((string) ($row[$idx['role']] ?? ''))) : '';
            $name     = isset($idx['name']) ? trim((string) ($row[$idx['name']] ?? '')) : '';
            $label    = $name !== '' ? $name : "legacy_id {$legacyId}";

            if (! preg_match('/^[6-9][0-9]{9}$/', $newMobile)) {
                CLI::write("  skip {$label}: '{$newMobile}' is not a valid 10-digit mobile", 'yellow');
                $skipped++;
                continue;
            }

            // Locate the staff user.
            $user = null;
            if ($legacyId !== '') {
                $m = $db->table('legacy_id_map')
                    ->where('old_table', 'user')->where('old_id', (int) $legacyId)
                    ->where('new_table', 'users')->get()->getFirstRow('array');
                if ($m) { $user = $db->table('users')->where('id', $m['new_id'])->get()->getFirstRow('array'); }
            }
            if (! $user && $role !== '' && $name !== '') {
                $matches = $db->table('users')->where('role', $role)->where('name', $name)->get()->getResultArray();
                if (count($matches) === 1) { $user = $matches[0]; }
                elseif (count($matches) > 1) {
                    CLI::write("  skip {$label}: {$role} name matches " . count($matches) . ' rows — add legacy_id to disambiguate', 'yellow');
                    $skipped++;
                    continue;
                }
            }
            if (! $user) {
                CLI::write("  skip {$label}: no matching staff found", 'yellow');
                $skipped++;
                continue;
            }

            // Keep (mobile, role) unique.
            $taken = $db->table('users')
                ->where('mobile_number', $newMobile)->where('role', $user['role'])
                ->where('id !=', $user['id'])->countAllResults();
            if ($taken > 0) {
                CLI::write("  skip {$label}: {$newMobile} already used by another {$user['role']}", 'yellow');
                $skipped++;
                continue;
            }

            $db->table('users')->where('id', $user['id'])->update(['mobile_number' => $newMobile]);
            $applied++;
        }
        fclose($fh);

        CLI::write('');
        CLI::write("Applied {$applied}, skipped {$skipped}.", 'green');
    }

    /** Strip spaces, +91 / 0 prefixes, and any non-digits. */
    private function normalize(string $v): string
    {
        $v = preg_replace('/\D+/', '', trim($v));
        if (strlen($v) === 12 && str_starts_with($v, '91')) { $v = substr($v, 2); }
        if (strlen($v) === 11 && str_starts_with($v, '0'))  { $v = substr($v, 1); }
        return $v;
    }
}
