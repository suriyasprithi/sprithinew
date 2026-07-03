<?php

namespace App\Controllers\Api;

use App\Models\CartItemModel;
use App\Models\ProductModel;
use App\Models\ProductVariantModel;
use App\Services\GstService;
use App\Services\PrescriptionPolicy;
use CodeIgniter\HTTP\ResponseInterface;

class CartController extends BaseApiController
{
    public function index(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);

        $cart = new CartItemModel();
        $rows = $cart->where('user_id', $auth->id)->findAll();
        if (! $rows) return $this->ok(['items' => [], 'total' => 0]);

        $pids = array_unique(array_map(static fn ($r) => (int) $r['product_id'], $rows));
        $vids = array_values(array_filter(array_map(static fn ($r) => (int) ($r['variation_id'] ?? 0), $rows)));
        $products = (new ProductModel())->whereIn('id', $pids)->findAll();
        $variants = $vids ? (new ProductVariantModel())->whereIn('id', $vids)->findAll() : [];
        $pById = []; foreach ($products as $p) $pById[(int) $p['id']] = $p;
        $vById = []; foreach ($variants as $v) $vById[(int) $v['id']] = $v;

        // Self-heal: drop cart rows that can no longer be ordered — the product was
        // deleted/deactivated, or its chosen variant no longer exists / is inactive.
        // Without this the item is hidden from the cart yet still blocks checkout
        // with "Some products are unavailable" (OrderController::place validates the
        // raw cart). Pruning here keeps what the customer sees == what they can buy.
        // Stock shortages are NOT pruned (the item is still valid — just low).
        $deadIds = [];
        foreach ($rows as $r) {
            $p   = $pById[(int) $r['product_id']] ?? null;
            $vid = (int) ($r['variation_id'] ?? 0);
            $bad = ! $p || ($p['status'] ?? '') !== 'active'
                || ($vid && (! isset($vById[$vid]) || ($vById[$vid]['status'] ?? '') !== 'active'));
            if ($bad) $deadIds[] = (int) $r['id'];
        }
        if ($deadIds) {
            $cart->whereIn('id', $deadIds)->delete();
            $rows = array_values(array_filter($rows, static fn ($r) => ! in_array((int) $r['id'], $deadIds, true)));
            if (! $rows) return $this->ok(['items' => [], 'total' => 0]);
        }

        // Resolve each product's vendor shop name (shop_name, else the vendor's
        // user name) so the cart can show who sells each item.
        $vendorIds    = array_values(array_unique(array_filter(array_map(static fn ($p) => (int) ($p['vendor_id'] ?? 0), $products))));
        $shopByVendor = [];
        if ($vendorIds) {
            $vrows = \Config\Database::connect()->query(
                'SELECT u.id, COALESCE(NULLIF(vp.shop_name, \'\'), u.name) AS shop
                 FROM users u LEFT JOIN vendor_profiles vp ON vp.user_id = u.id
                 WHERE u.id IN (' . implode(',', array_map('intval', $vendorIds)) . ')'
            )->getResultArray();
            foreach ($vrows as $rv) $shopByVendor[(int) $rv['id']] = $rv['shop'];
        }

        // Per-product GST rate from each product's vendor category (default 0).
        $gstRates = GstService::ratesForProducts($products);

        $items    = [];
        $total    = 0;
        $gstTotal = 0;
        foreach ($rows as $r) {
            $p = $pById[(int) $r['product_id']] ?? null;
            if (! $p) continue;
            $variation = null;
            $price = (float) $p['price'];
            $label = null;
            $vid   = (int) ($r['variation_id'] ?? 0);
            if ($vid && isset($vById[$vid])) {
                $variation = $vById[$vid];
                $price = (float) $variation['price'];
                $label = $variation['name'];
            }
            $sub = $price * (int) $r['qty'];
            $total += $sub;
            $gstRate = $gstRates[(int) $p['id']] ?? 0.0;
            $gstAmt  = GstService::lineGst($sub, $gstRate);
            $gstTotal += $gstAmt;
            $items[] = [
                'cart_id'         => (int) $r['id'],
                'product_id'      => (int) $p['id'],
                'name'            => $p['name'],
                'price'           => $price,
                'image'           => ($variation && ! empty($variation['image'])) ? $variation['image'] : $p['image'],
                'qty'             => (int) $r['qty'],
                'subtotal'        => $sub,
                'gst_rate'        => $gstRate,
                'gst_amount'      => $gstAmt,
                'vendor_id'       => (int) $p['vendor_id'],
                'vendor_shop'     => $shopByVendor[(int) $p['vendor_id']] ?? null,
                'variation_id'    => $vid ?: null,
                'variation_label' => $label,
            ];
        }
        // Medicine-category items (medicals / siddha / homeopathy) require the
        // customer to attach a prescription at checkout — flag it so the
        // checkout page can show the required upload field.
        $requiresPrescription = PrescriptionPolicy::requiresFor($products);

        return $this->ok([
            'items'                 => $items,
            'total'                 => $total,
            'gst_total'             => round($gstTotal, 2),
            'requires_prescription' => $requiresPrescription,
        ]);
    }

    public function add(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);

        if (! $this->validate([
            'product_id'   => 'required|integer',
            'qty'          => 'permit_empty|integer|greater_than[0]',
            'variation_id' => 'permit_empty|integer',
        ])) return $this->fail('Validation failed', 422, $this->validator->getErrors());

        $d = $this->request->getJSON(true) ?? $this->request->getPost();
        $product = (new ProductModel())->find((int) $d['product_id']);
        if (! $product || $product['status'] !== 'active') return $this->fail('Product unavailable', 404);

        $qty  = (int) ($d['qty'] ?? 1);
        $vid  = (int) ($d['variation_id'] ?? 0) ?: null;

        if ((int) ($product['has_variants'] ?? 0) === 1 && ! $vid) {
            return $this->fail('Please select a variant', 422);
        }

        if ($vid) {
            $variant = (new ProductVariantModel())->find($vid);
            if (! $variant || (int) $variant['product_id'] !== (int) $product['id'] || $variant['status'] !== 'active') {
                return $this->fail('Variant unavailable', 404);
            }
            if ((int) $variant['stock'] < $qty) return $this->fail('Insufficient stock', 409);
        } else {
            if ((int) ($product['stock'] ?? 0) < $qty) return $this->fail('Insufficient stock', 409);
        }

        $cart = new CartItemModel();
        $existing = $cart->where('user_id', $auth->id)
            ->where('product_id', (int) $product['id'])
            ->where('variation_id', $vid)
            ->first();
        if ($existing) {
            $cart->update($existing['id'], ['qty' => (int) $existing['qty'] + $qty]);
        } else {
            $cart->insert(['user_id' => $auth->id, 'product_id' => (int) $product['id'], 'variation_id' => $vid, 'qty' => $qty]);
        }
        return $this->ok(null, 'Added to cart');
    }

    public function setQty(int $cartId): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        $d = $this->request->getJSON(true) ?? $this->request->getPost();
        $qty = (int) ($d['qty'] ?? 0);
        $cart = new CartItemModel();
        $row = $cart->find($cartId);
        if (! $row || (int) $row['user_id'] !== (int) $auth->id) return $this->fail('Not found', 404);
        if ($qty <= 0) {
            $cart->delete($cartId);
            return $this->ok(null, 'Removed');
        }
        $cart->update($cartId, ['qty' => $qty]);
        return $this->ok(null, 'Updated');
    }

    public function remove(int $cartId): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        $cart = new CartItemModel();
        $row = $cart->find($cartId);
        if (! $row || (int) $row['user_id'] !== (int) $auth->id) return $this->fail('Not found', 404);
        $cart->delete($cartId);
        return $this->ok(null, 'Removed');
    }

    public function clear(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        (new CartItemModel())->where('user_id', $auth->id)->delete();
        return $this->ok(null, 'Cleared');
    }
}
