<?php

namespace App\Controllers\Api;

use App\Models\DeviceTokenModel;
use CodeIgniter\HTTP\ResponseInterface;

class DeviceController extends BaseApiController
{
    public function register(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);

        $rules = [
            'token'    => 'required|string|max_length[255]',
            'platform' => 'required|in_list[android,ios,web]',
        ];
        if (! $this->validate($rules)) {
            return $this->fail('Validation failed', 422, $this->validator->getErrors());
        }
        $data = $this->request->getJSON(true) ?? $this->request->getPost();
        (new DeviceTokenModel())->upsertToken((int) $auth->id, $data['token'], $data['platform']);
        return $this->ok(null, 'Device registered');
    }

    public function unregister(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        $token = $this->request->getJSON(true)['token'] ?? $this->request->getPost('token');
        if (! $token) return $this->fail('token required', 422);
        (new DeviceTokenModel())->where('user_id', $auth->id)->where('token', $token)->delete();
        return $this->ok(null, 'Device unregistered');
    }
}
