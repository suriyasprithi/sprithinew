<?php

namespace App\Services;

use Config\Database;

/**
 * Single source of truth for "does this cart/order need a prescription file?".
 *
 * Products whose vendor_category is a medicine category (medicals / siddha
 * Medicine / Homeopathy) require the customer to attach a prescription at
 * checkout. Matched by NAME (case-insensitive) — not a hard-coded id — so it
 * keeps working across the dev (epey_v2) and prod databases, whose
 * vendor_categories ids differ.
 *
 * Used by CartController (to flag the cart) and OrderController (to enforce
 * the upload authoritatively at placement).
 */
class PrescriptionPolicy
{
    /** Vendor-category names that force a prescription upload (lowercased). */
    private const NAMES = ['medicals', 'siddha medicine', 'homeopathy'];

    /** @var int[]|null cached per-request */
    private static ?array $ids = null;

    /** Vendor-category ids that require a prescription. Cached per request. */
    public static function categoryIds(): array
    {
        if (self::$ids !== null) return self::$ids;

        // Filter in PHP (only a few dozen categories) so a case-insensitive name
        // match doesn't depend on a function-in-column-key SQL escape.
        $rows = Database::connect()->table('vendor_categories')
            ->select('id, name')->get()->getResultArray();

        $ids = [];
        foreach ($rows as $r) {
            if (in_array(strtolower(trim((string) $r['name'])), self::NAMES, true)) {
                $ids[] = (int) $r['id'];
            }
        }
        return self::$ids = $ids;
    }

    /**
     * True if any product row belongs to a prescription-required vendor category.
     * @param array<int,array<string,mixed>> $products product rows (need vendor_category_id)
     */
    public static function requiresFor(array $products): bool
    {
        $ids = self::categoryIds();
        if (! $ids) return false;
        foreach ($products as $p) {
            if (in_array((int) ($p['vendor_category_id'] ?? 0), $ids, true)) return true;
        }
        return false;
    }
}
