<?php

namespace App\Controllers\Api;

use App\Models\CartItemModel;
use App\Models\ProductModel;
use App\Models\ProductVariantModel;
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

        $items = [];
        $total = 0;
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
            $items[] = [
                'cart_id'         => (int) $r['id'],
                'product_id'      => (int) $p['id'],
                'name'            => $p['name'],
                'price'           => $price,
                'image'           => ($variation && ! empty($variation['image'])) ? $variation['image'] : $p['image'],
                'qty'             => (int) $r['qty'],
                'subtotal'        => $sub,
                'vendor_id'       => (int) $p['vendor_id'],
                'variation_id'    => $vid ?: null,
                'variation_label' => $label,
            ];
        }
        // Medicine-category items (medicals / siddha / homeopathy) require the
        // customer to attach a prescription at checkout — flag it so the
        // checkout page can show the required upload field.
        $requiresPrescription = PrescriptionPolicy::requiresFor($products);

        return $this->ok(['items' => $items, 'total' => $total, 'requires_prescription' => $requiresPrescription]);
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
