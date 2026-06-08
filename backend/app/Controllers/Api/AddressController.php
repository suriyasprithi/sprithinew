<?php

namespace App\Controllers\Api;

use App\Models\CustomerAddressModel;
use CodeIgniter\HTTP\ResponseInterface;

class AddressController extends BaseApiController
{
    /** GET /customer/addresses — list, default first. */
    public function index(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);

        $model = new CustomerAddressModel();
        return $this->ok(['items' => $model->forCustomer((int) $auth->id)]);
    }

    /** POST /customer/addresses — create. First address auto-becomes default. */
    public function create(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        if (! $this->validate($this->rules())) {
            return $this->fail('Validation failed', 422, $this->validator->getErrors());
        }

        $d     = $this->request->getJSON(true) ?? $this->request->getPost();
        $model = new CustomerAddressModel();

        $count       = $model->where('customer_id', (int) $auth->id)->countAllResults();
        $wantDefault = ! empty($d['is_default']) || $count === 0;

        $id = $model->insert([
            'customer_id'  => (int) $auth->id,
            'address_line' => $this->clean($d['address_line'] ?? ''),
            'landmark'     => $this->clean($d['landmark'] ?? ''),
            'city'         => $this->clean($d['city'] ?? ''),
            'pincode'      => $this->clean($d['pincode'] ?? ''),
            'is_default'   => $wantDefault ? 1 : 0,
        ], true);

        if ($wantDefault) $model->makeDefault((int) $auth->id, (int) $id);

        return $this->ok(['items' => $model->forCustomer((int) $auth->id)], 'Address added', 201);
    }

    /** PATCH /customer/addresses/{id} — edit. */
    public function update(int $id): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        if (! $this->validate($this->rules())) {
            return $this->fail('Validation failed', 422, $this->validator->getErrors());
        }

        $model = new CustomerAddressModel();
        if (! $model->ownedBy($id, (int) $auth->id)) return $this->fail('Not found', 404);

        $d       = $this->request->getJSON(true) ?? $this->request->getPost();
        $payload = [];
        foreach (['address_line', 'landmark', 'city', 'pincode'] as $k) {
            if (array_key_exists($k, $d)) $payload[$k] = $this->clean($d[$k]);
        }
        if ($payload) $model->update($id, $payload);

        // Only promotes to default; you can't un-default directly — set another instead.
        if (! empty($d['is_default'])) $model->makeDefault((int) $auth->id, $id);

        return $this->ok(['items' => $model->forCustomer((int) $auth->id)], 'Address updated');
    }

    /** POST /customer/addresses/{id}/default — make this the default. */
    public function setDefault(int $id): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);

        $model = new CustomerAddressModel();
        if (! $model->ownedBy($id, (int) $auth->id)) return $this->fail('Not found', 404);

        $model->makeDefault((int) $auth->id, $id);
        return $this->ok(['items' => $model->forCustomer((int) $auth->id)], 'Default address set');
    }

    /** DELETE /customer/addresses/{id} — blocked if it's the only one. */
    public function delete(int $id): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);

        $model    = new CustomerAddressModel();
        $existing = $model->ownedBy($id, (int) $auth->id);
        if (! $existing) return $this->fail('Not found', 404);

        $count = $model->where('customer_id', (int) $auth->id)->countAllResults();
        if ($count <= 1) return $this->fail('Cannot delete your only address', 409);

        $wasDefault = (int) ($existing['is_default'] ?? 0) === 1;
        $model->delete($id);

        // If the default was removed, promote the newest remaining address.
        if ($wasDefault) {
            $next = $model->where('customer_id', (int) $auth->id)->orderBy('id', 'DESC')->first();
            if ($next) $model->makeDefault((int) $auth->id, (int) $next['id']);
        }

        return $this->ok(['items' => $model->forCustomer((int) $auth->id)], 'Address deleted');
    }

    private function rules(): array
    {
        return [
            'address_line' => 'required|string|max_length[255]',
            'landmark'     => 'permit_empty|string|max_length[100]',
            'city'         => 'permit_empty|string|max_length[80]',
            'pincode'      => 'permit_empty|string|max_length[10]',
        ];
    }

    /** Trim a value; empty string becomes null. */
    private function clean($v): ?string
    {
        $v = trim((string) $v);
        return $v === '' ? null : $v;
    }
}
