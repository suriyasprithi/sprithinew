<?php

namespace App\Controllers\Api;

use App\Models\WishlistModel;
use App\Models\ProductModel;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Server-side wishlist (per customer account). Replaces the browser-only list so
 * favourites survive re-imports (dead product ids are pruned on read), a cleared
 * localStorage, and sync across devices. The client still keeps a localStorage
 * cache for instant UI + guests; it hydrates from here on sign-in.
 */
class WishlistController extends BaseApiController
{
    /** GET /wishlist — saved product ids, most-recent first, ONLY products that still exist + are active. */
    public function index(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);

        $rows = (new WishlistModel())->where('user_id', $auth->id)->orderBy('id', 'DESC')->findAll();
        $pids = array_values(array_unique(array_map(static fn ($r) => (int) $r['product_id'], $rows)));
        if (! $pids) return $this->ok(['ids' => []]);

        // Only ids whose product is still live — self-heals after imports/deletes so
        // the wishlist can never show a stale/wrong product for a reassigned id.
        $liveRows = (new ProductModel())->select('id')->whereIn('id', $pids)->where('status', 'active')->findAll();
        $liveSet  = [];
        foreach ($liveRows as $lr) $liveSet[(int) $lr['id']] = true;

        // Prune dead rows so they can't linger.
        $dead = array_values(array_filter($pids, static fn ($id) => ! isset($liveSet[$id])));
        if ($dead) (new WishlistModel())->where('user_id', $auth->id)->whereIn('product_id', $dead)->delete();

        // Preserve the saved order (most-recent first), keep only live + de-duped.
        $ordered = [];
        foreach ($rows as $r) {
            $pid = (int) $r['product_id'];
            if (isset($liveSet[$pid]) && ! in_array($pid, $ordered, true)) $ordered[] = $pid;
        }
        return $this->ok(['ids' => $ordered]);
    }

    /** POST /wishlist { product_id } — add (idempotent; a non-existent product is rejected so dead ids can't be stored). */
    public function add(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);

        $d   = $this->request->getJSON(true) ?? $this->request->getPost() ?? [];
        $pid = (int) ($d['product_id'] ?? 0);
        if ($pid <= 0) return $this->fail('product_id required', 422);
        if (! (new ProductModel())->where('id', $pid)->where('status', 'active')->first()) {
            return $this->fail('Product not found', 404);
        }

        $m = new WishlistModel();
        if (! $m->where('user_id', $auth->id)->where('product_id', $pid)->first()) {
            $m->insert(['user_id' => $auth->id, 'product_id' => $pid, 'created_at' => date('Y-m-d H:i:s')]);
        }
        return $this->ok(null, 'Added');
    }

    /** DELETE /wishlist/{productId} — remove one. */
    public function remove(int $productId): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        (new WishlistModel())->where('user_id', $auth->id)->where('product_id', $productId)->delete();
        return $this->ok(null, 'Removed');
    }

    /** DELETE /wishlist — clear all. */
    public function clear(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        (new WishlistModel())->where('user_id', $auth->id)->delete();
        return $this->ok(null, 'Cleared');
    }
}
