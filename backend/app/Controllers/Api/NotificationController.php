<?php

namespace App\Controllers\Api;

use App\Models\NotificationModel;
use App\Services\NotificationService;
use CodeIgniter\HTTP\ResponseInterface;

class NotificationController extends BaseApiController
{
    public function index(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        $model = new NotificationModel();
        return $this->ok([
            'items'        => $model->listFor((int) $auth->id),
            'unread_count' => $model->unreadCount((int) $auth->id),
        ]);
    }

    public function markRead(int $id): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        (new NotificationModel())->markRead((int) $auth->id, $id);
        return $this->ok(null, 'Marked read');
    }

    /** Admin: send a notification to a single user, or a role. */
    public function send(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth || $auth->role !== 'admin') return $this->fail('Forbidden', 403);

        $rules = [
            'title' => 'required|string|max_length[150]',
            'body'  => 'permit_empty|string|max_length[1000]',
        ];
        if (! $this->validate($rules)) {
            return $this->fail('Validation failed', 422, $this->validator->getErrors());
        }
        $data    = $this->request->getJSON(true) ?? $this->request->getPost();
        $service = new NotificationService();

        if (! empty($data['user_id'])) {
            $r = $service->sendToUser((int) $data['user_id'], $data['title'], $data['body'] ?? null, $data['data'] ?? null);
            return $this->ok($r, 'Sent');
        }
        if (! empty($data['role'])) {
            $r = $service->sendToRole($data['role'], $data['title'], $data['body'] ?? null, $data['data'] ?? null);
            return $this->ok($r, 'Sent');
        }
        return $this->fail('Provide user_id or role', 422);
    }
}
