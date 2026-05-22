<?php

namespace App\Controllers\Api;

use App\Models\ReferralModel;
use App\Models\UserModel;
use CodeIgniter\HTTP\ResponseInterface;

class ReferralController extends BaseApiController
{
    /** Customer: my refer link + count. */
    public function info(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        $u = (new UserModel())->find($auth->id);
        $count = (new ReferralModel())->where('referrer_id', $auth->id)->countAllResults();
        $totalBonus = (float) ((new ReferralModel())->selectSum('bonus_amount')->where('referrer_id', $auth->id)->first()['bonus_amount'] ?? 0);
        return $this->ok([
            'referral_code' => $u['mobile_number'],
            'count'         => $count,
            'total_bonus'   => $totalBonus,
        ]);
    }

    public function list(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        $rows = (new ReferralModel())->where('referrer_id', $auth->id)->orderBy('id', 'DESC')->findAll(100);
        $ids  = array_unique(array_map(static fn ($r) => (int) $r['referred_id'], $rows));
        $users = $ids ? (new UserModel())->whereIn('id', $ids)->findAll() : [];
        $byId = [];
        foreach ($users as $u) $byId[(int) $u['id']] = ['name' => $u['name'], 'mobile_number' => $u['mobile_number']];
        $items = array_map(static fn ($r) => $r + ['referred' => $byId[(int) $r['referred_id']] ?? null], $rows);
        return $this->ok(['items' => $items]);
    }
}
