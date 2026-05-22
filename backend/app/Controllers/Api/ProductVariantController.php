<?php

namespace App\Controllers\Api;

use App\Models\ProductAccessoryModel;
use App\Models\ProductModel;
use App\Models\ProductVariantModel;
use CodeIgniter\HTTP\ResponseInterface;

class ProductVariantController extends BaseApiController
{
    public function listForProduct(int $productId): ResponseInterface
    {
        $variants = (new ProductVariantModel())->where('product_id', $productId)->orderBy('id', 'ASC')->findAll();
        $accessories = (new ProductAccessoryModel())->where('product_id', $productId)->orderBy('id', 'ASC')->findAll();
        return $this->ok(['variants' => $variants, 'accessories' => $accessories]);
    }

    public function createVariant(int $productId): ResponseInterface
    {
        if ($r = $this->guardOwner($productId)) return $r;
        if (! $this->validate(['name' => 'required|string|max_length[100]', 'price' => 'permit_empty|numeric'])) {
            return $this->fail('Validation failed', 422, $this->validator->getErrors());
        }
        $d = $this->request->getJSON(true) ?? $this->request->getPost();
        $id = (new ProductVariantModel())->insert([
            'product_id' => $productId,
            'name'       => $d['name'],
            'price'      => $d['price'] ?? 0,
            'stock'      => $d['stock'] ?? 0,
            'image'      => $d['image'] ?? null,
            'status'     => $d['status'] ?? 'active',
        ], true);
        $this->syncHasVariants($productId);
        return $this->ok(['id' => (int) $id], 'Created');
    }

    public function updateVariant(int $productId, int $id): ResponseInterface
    {
        if ($r = $this->guardOwner($productId)) return $r;
        $d = $this->request->getJSON(true) ?? $this->request->getPost();
        $payload = array_intersect_key($d, array_flip(['name', 'price', 'stock', 'image', 'status']));
        if (! $payload) return $this->fail('Nothing to update', 422);
        (new ProductVariantModel())->update($id, $payload);
        $this->syncHasVariants($productId);
        return $this->ok(null, 'Updated');
    }

    public function deleteVariant(int $productId, int $id): ResponseInterface
    {
        if ($r = $this->guardOwner($productId)) return $r;
        (new ProductVariantModel())->delete($id);
        $this->syncHasVariants($productId);
        return $this->ok(null, 'Deleted');
    }

    private function syncHasVariants(int $productId): void
    {
        $count = (new ProductVariantModel())->where('product_id', $productId)->where('status', 'active')->countAllResults();
        (new ProductModel())->update($productId, ['has_variants' => $count > 0 ? 1 : 0]);
    }

    public function createAccessory(int $productId): ResponseInterface
    {
        if ($r = $this->guardOwner($productId)) return $r;
        if (! $this->validate(['name' => 'required|string|max_length[100]', 'price' => 'permit_empty|numeric'])) {
            return $this->fail('Validation failed', 422, $this->validator->getErrors());
        }
        $d = $this->request->getJSON(true) ?? $this->request->getPost();
        $id = (new ProductAccessoryModel())->insert([
            'product_id' => $productId,
            'name'       => $d['name'],
            'price'      => $d['price'] ?? 0,
        ], true);
        return $this->ok(['id' => (int) $id], 'Created');
    }

    public function deleteAccessory(int $productId, int $id): ResponseInterface
    {
        if ($r = $this->guardOwner($productId)) return $r;
        (new ProductAccessoryModel())->delete($id);
        return $this->ok(null, 'Deleted');
    }

    private function guardOwner(int $productId): ?ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        if (! in_array($auth->role, ['vendor', 'admin'], true)) return $this->fail('Forbidden', 403);
        $row = (new ProductModel())->find($productId);
        if (! $row) return $this->fail('Product not found', 404);
        if ($auth->role !== 'admin' && (int) $row['vendor_id'] !== (int) $auth->id) return $this->fail('Forbidden', 403);
        return null;
    }
}
