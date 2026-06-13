<?php

namespace App\Controllers\Api;

use App\Services\SystemSettingsService;
use CodeIgniter\HTTP\ResponseInterface;

class AdminSettingsController extends BaseApiController
{
    /**
     * Engine-read keys that may not be seeded yet — merged in so they always
     * appear in the admin Settings page with their code defaults.
     *   token.bonus.*  → TokenService::bonusFactorForRole()
     *   commission.*   → CommissionService::distributeForOrder()
     *   welcome.*      → WelcomeBonusService::award() (per-level signup bonus)
     *   mlm.level_*    → CommissionService::distributeForOrder() (L1/L2/L3 split)
     *   buyback.slot_* → CommissionService::distributeForOrder() (FIFO slot %)
     *   delivery.free.*→ FreeDeliveryService::evaluateForCart() (free-delivery rules)
     *
     * The welcome.* keys are listed L1 → L2 → L3 → active so the "Welcome bonus"
     * card renders them in that order (array_merge keeps first-seen key position;
     * stored values still win over these defaults).
     */
    private const DEFAULTS = [
        'commission.lucky_draw_pct'  => '3',
        'commission.token_share_pct' => '3.5',
        'token.bonus.state'          => '3.5',
        'token.bonus.district'       => '3',
        'token.bonus.taluk'          => '2',
        'welcome.bonus_amount'       => '15',
        'welcome.bonus_l2'           => '10',
        'welcome.bonus_l3'           => '5',
        'welcome.bonus_active'       => '1',
        'mlm.level_1_pct'            => '25',
        'mlm.level_2_pct'            => '10',
        'mlm.level_3_pct'            => '1.5',
        'buyback.slot_1_pct'         => '15',
        'buyback.slot_2_pct'         => '10',
        'buyback.slot_3_pct'         => '5',
        'buyback.slot_4_pct'         => '2.5',
        // Free-delivery rules — all OFF by default (no change until enabled).
        // Priority when several are on: Category > Amount > Time > ETA.
        'delivery.free.category_enabled' => '0',
        'delivery.free.amount_enabled'   => '0',
        'delivery.free.amount_min'       => '500',
        'delivery.free.time_enabled'     => '0',
        'delivery.free.time_from'        => '09:00',
        'delivery.free.time_to'          => '18:00',
        'delivery.free.eta_enabled'      => '0',
        'delivery.free.eta_hours'        => '4',
        'delivery.free.eta_min_amount'   => '500',
    ];

    /**
     * Keys never shown/editable in the admin Settings UI:
     *   - legacy keys nothing reads (avoid confusion)
     *   - operational state the engine manages itself (editing would break the
     *     buyback cycle)
     *   - delivery.* (unused; real rates live on the Delivery Rates page) and the
     *     token markup keys (still read by TokenService, just not editable here)
     */
    private const HIDDEN = [
        'token.markup_taluk_pct', 'token.markup_district_pct', 'token.markup_state_pct',
        'geo.taluk_pct', 'geo.district_pct', 'geo.state_pct',
        'buyback.eligible_user_id', 'buyback.eligible_since',
        'delivery.base_fee', 'delivery.rate_per_km', 'delivery.rate_per_hour',
        'token.base_rate', 'token.markup.state', 'token.markup.district', 'token.markup.taluk',
    ];

    public function index(): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;
        return $this->ok($this->presentable((new SystemSettingsService())->all()));
    }

    public function update(): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;
        $d = $this->request->getJSON(true) ?? $this->request->getPost();
        if (! is_array($d)) return $this->fail('Invalid payload', 422);
        $svc = new SystemSettingsService();
        foreach ($d as $key => $value) {
            if (! is_string($key) || in_array($key, self::HIDDEN, true)) continue;
            $svc->set($key, (string) $value);
        }
        return $this->ok($this->presentable($svc->all()), 'Saved');
    }

    /** Merge engine defaults in and strip hidden keys for the admin UI. */
    private function presentable(array $stored): array
    {
        $merged = array_merge(self::DEFAULTS, $stored);
        foreach (self::HIDDEN as $k) unset($merged[$k]);
        return $merged;
    }

    private function requireAdmin(): ?ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        if ($auth->role !== 'admin') return $this->fail('Forbidden', 403);
        return null;
    }
}
