<?php

namespace App\Models;

use CodeIgniter\Model;

class HomeBannerModel extends Model
{
    protected $table            = 'home_banners';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = false;
    protected $protectFields    = true;

    protected $allowedFields = [
        'slot', 'sort_order',
        'eyebrow', 'title', 'highlight', 'subtitle',
        'cta_label', 'cta_href',
        'image_url',
        'gradient_from', 'gradient_mid', 'gradient_to',
        'icon_name',
        'status',
    ];

    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';

    /** Valid slot values. Keep in sync with frontend. */
    public const SLOTS = [
        'coupon',
        'hero_left',
        'hero_center',
        'hero_right_top',
        'hero_right_bottom',
        'mega_left',
        'mega_right',
    ];

    /** Group active banners by slot for public consumption. */
    public function activeBySlot(): array
    {
        $rows = $this
            ->where('status', 'active')
            ->orderBy('slot', 'ASC')
            ->orderBy('sort_order', 'ASC')
            ->orderBy('id', 'ASC')
            ->findAll();

        $out = [];
        foreach (self::SLOTS as $s) $out[$s] = [];
        foreach ($rows as $r) {
            $slot = $r['slot'];
            if (! isset($out[$slot])) $out[$slot] = [];
            $out[$slot][] = $r;
        }
        return $out;
    }
}
