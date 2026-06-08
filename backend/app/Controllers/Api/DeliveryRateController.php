<?php

namespace App\Controllers\Api;

use App\Models\CartItemModel;
use App\Models\DeliveryKmSlabModel;
use App\Models\DeliveryTimeRateModel;
use App\Models\DistrictModel;
use App\Models\ProductModel;
use App\Models\StateModel;
use App\Models\TalukModel;
use App\Models\VendorProfileModel;
use CodeIgniter\HTTP\ResponseInterface;

class DeliveryRateController extends BaseApiController
{
    public function indexKm(): ResponseInterface
    {
        if ($r = $this->requireRole(['admin'])) return $r;
        $rows = (new DeliveryKmSlabModel())->orderBy('id', 'DESC')->findAll(500);
        return $this->ok(['items' => $this->decorate($rows)]);
    }

    /**
     * KM slabs for the current customer's cart vendor's taluk.
     * Used by the checkout page to compute delivery fee.
     */
    public function customerSlabs(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);

        $cart = (new CartItemModel())->where('user_id', (int) $auth->id)->findAll();
        if (! $cart) return $this->ok(['items' => []]);

        $productIds = array_values(array_unique(array_map(static fn ($r) => (int) $r['product_id'], $cart)));
        $products   = $productIds ? (new ProductModel())->whereIn('id', $productIds)->findAll() : [];
        $vendorIds  = array_values(array_unique(array_filter(array_map(static fn ($p) => (int) ($p['vendor_id'] ?? 0), $products))));
        if (! $vendorIds) return $this->ok(['items' => []]);

        // Use the first vendor's taluk (cart is typically single-vendor anyway).
        $vendorProfile = (new VendorProfileModel())->where('user_id', (int) $vendorIds[0])->first();
        $talukId = (int) ($vendorProfile['taluk_id'] ?? 0);
        if (! $talukId) return $this->ok(['items' => []]);

        $slabs = (new DeliveryKmSlabModel())
            ->where('taluk_id', $talukId)
            ->orderBy('from_km', 'ASC')
            ->findAll();

        return $this->ok([
            'items'    => array_map(static fn ($s) => [
                'id'           => (int) $s['id'],
                'from_km'      => (float) $s['from_km'],
                'to_km'        => (float) $s['to_km'],
                'price_per_km' => (float) $s['price_per_km'],
            ], $slabs),
            'taluk_id' => $talukId,
        ]);
    }

    public function indexTime(): ResponseInterface
    {
        if ($r = $this->requireRole(['admin'])) return $r;
        $rows = (new DeliveryTimeRateModel())->orderBy('id', 'DESC')->findAll(500);
        return $this->ok(['items' => $this->decorate($rows)]);
    }

    /**
     * Time-based delivery rates for the current customer's cart vendor's taluk.
     * Used by the checkout page to populate the delivery-fee dropdown. Returned
     * cheapest-first so the UI can default-select the lowest price.
     */
    public function customerTimeRates(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);

        $talukId = $this->cartTalukId((int) $auth->id);
        if (! $talukId) return $this->ok(['items' => [], 'taluk_id' => 0]);

        // The rate table has exact-duplicate rows (legacy import) — collapse
        // identical (time_min, price) pairs so the dropdown shows each option
        // once. MIN(id) is a real row in this taluk, so place() still validates.
        $rates = (new DeliveryTimeRateModel())
            ->select('MIN(id) AS id, time_min, price')
            ->where('taluk_id', $talukId)
            ->groupBy(['time_min', 'price'])
            ->orderBy('price', 'ASC')
            ->orderBy('time_min', 'DESC')
            ->findAll();

        return $this->ok([
            'items'    => array_map(static fn ($r) => [
                'id'       => (int) $r['id'],
                'time_min' => (int) $r['time_min'],
                'price'    => (float) $r['price'],
            ], $rates),
            'taluk_id' => $talukId,
        ]);
    }

    /** Resolve the taluk of the (first) vendor in the customer's cart, or 0. */
    private function cartTalukId(int $userId): int
    {
        $cart = (new CartItemModel())->where('user_id', $userId)->findAll();
        if (! $cart) return 0;

        $productIds = array_values(array_unique(array_map(static fn ($r) => (int) $r['product_id'], $cart)));
        $products   = $productIds ? (new ProductModel())->whereIn('id', $productIds)->findAll() : [];
        $vendorIds  = array_values(array_unique(array_filter(array_map(static fn ($p) => (int) ($p['vendor_id'] ?? 0), $products))));
        if (! $vendorIds) return 0;

        $vendorProfile = (new VendorProfileModel())->where('user_id', (int) $vendorIds[0])->first();
        return (int) ($vendorProfile['taluk_id'] ?? 0);
    }

    public function createKm(): ResponseInterface
    {
        if ($r = $this->requireRole(['admin'])) return $r;
        if (! $this->validate([
            'taluk_id'     => 'required|is_natural_no_zero',
            'from_km'      => 'required|numeric',
            'to_km'        => 'required|numeric|greater_than[0]',
            'price_per_km' => 'required|numeric',
        ])) return $this->fail('Validation failed', 422, $this->validator->getErrors());

        $d = $this->request->getJSON(true) ?? $this->request->getPost();
        $id = (new DeliveryKmSlabModel())->insert([
            'taluk_id'     => (int) $d['taluk_id'],
            'from_km'      => (float) $d['from_km'],
            'to_km'        => (float) $d['to_km'],
            'price_per_km' => (float) $d['price_per_km'],
        ], true);
        return $this->ok(['id' => (int) $id], 'Created');
    }

    public function updateKm(int $id): ResponseInterface
    {
        if ($r = $this->requireRole(['admin'])) return $r;
        $model = new DeliveryKmSlabModel();
        if (! $model->find($id)) return $this->fail('Not found', 404);

        $d = $this->request->getJSON(true) ?? $this->request->getPost();
        $payload = array_intersect_key($d, array_flip(['taluk_id', 'from_km', 'to_km', 'price_per_km']));
        foreach (['from_km', 'to_km', 'price_per_km'] as $k) if (isset($payload[$k])) $payload[$k] = (float) $payload[$k];
        if (isset($payload['taluk_id'])) $payload['taluk_id'] = (int) $payload['taluk_id'];
        if ($payload) $model->update($id, $payload);
        return $this->ok(null, 'Updated');
    }

    public function deleteKm(int $id): ResponseInterface
    {
        if ($r = $this->requireRole(['admin'])) return $r;
        (new DeliveryKmSlabModel())->delete($id);
        return $this->ok(null, 'Deleted');
    }

    public function createTime(): ResponseInterface
    {
        if ($r = $this->requireRole(['admin'])) return $r;
        if (! $this->validate([
            'taluk_id' => 'required|is_natural_no_zero',
            'time_min' => 'required|is_natural_no_zero',
            'price'    => 'required|numeric',
        ])) return $this->fail('Validation failed', 422, $this->validator->getErrors());

        $d = $this->request->getJSON(true) ?? $this->request->getPost();
        $id = (new DeliveryTimeRateModel())->insert([
            'taluk_id' => (int) $d['taluk_id'],
            'time_min' => (int) $d['time_min'],
            'price'    => (float) $d['price'],
        ], true);
        return $this->ok(['id' => (int) $id], 'Created');
    }

    public function updateTime(int $id): ResponseInterface
    {
        if ($r = $this->requireRole(['admin'])) return $r;
        $model = new DeliveryTimeRateModel();
        if (! $model->find($id)) return $this->fail('Not found', 404);

        $d = $this->request->getJSON(true) ?? $this->request->getPost();
        $payload = array_intersect_key($d, array_flip(['taluk_id', 'time_min', 'price']));
        if (isset($payload['taluk_id'])) $payload['taluk_id'] = (int) $payload['taluk_id'];
        if (isset($payload['time_min'])) $payload['time_min'] = (int) $payload['time_min'];
        if (isset($payload['price']))    $payload['price']    = (float) $payload['price'];
        if ($payload) $model->update($id, $payload);
        return $this->ok(null, 'Updated');
    }

    public function deleteTime(int $id): ResponseInterface
    {
        if ($r = $this->requireRole(['admin'])) return $r;
        (new DeliveryTimeRateModel())->delete($id);
        return $this->ok(null, 'Deleted');
    }

    private function requireRole(array $roles): ?ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        if (! in_array($auth->role, $roles, true)) return $this->fail('Forbidden', 403);
        return null;
    }

    /** Add state/district/taluk names by joining tables in PHP (small data, fine). */
    private function decorate(array $rows): array
    {
        if (! $rows) return [];
        $talukIds = array_values(array_unique(array_map(static fn ($r) => (int) ($r['taluk_id'] ?? 0), $rows)));
        $taluks = $talukIds ? (new TalukModel())->whereIn('id', $talukIds)->findAll() : [];
        $talukById = [];
        foreach ($taluks as $t) $talukById[(int) $t['id']] = $t;

        $districtIds = array_values(array_unique(array_filter(array_map(static fn ($t) => (int) ($t['district_id'] ?? 0), $taluks))));
        $districts = $districtIds ? (new DistrictModel())->whereIn('id', $districtIds)->findAll() : [];
        $districtById = [];
        foreach ($districts as $d) $districtById[(int) $d['id']] = $d;

        $stateIds = array_values(array_unique(array_filter(array_map(static fn ($d) => (int) ($d['state_id'] ?? 0), $districts))));
        $states = $stateIds ? (new StateModel())->whereIn('id', $stateIds)->findAll() : [];
        $stateById = [];
        foreach ($states as $s) $stateById[(int) $s['id']] = $s;

        $out = [];
        foreach ($rows as $r) {
            $taluk    = $talukById[(int) ($r['taluk_id'] ?? 0)] ?? null;
            $district = $taluk ? ($districtById[(int) ($taluk['district_id'] ?? 0)] ?? null) : null;
            $state    = $district ? ($stateById[(int) ($district['state_id'] ?? 0)] ?? null) : null;
            $out[] = $r + [
                'taluk_name'    => $taluk['name']    ?? null,
                'district_name' => $district['name'] ?? null,
                'state_name'    => $state['name']    ?? null,
            ];
        }
        return $out;
    }
}
