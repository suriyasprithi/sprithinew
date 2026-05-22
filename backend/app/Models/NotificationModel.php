<?php

namespace App\Models;

use CodeIgniter\Model;

class NotificationModel extends Model
{
    protected $table            = 'notifications';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = false;
    protected $protectFields    = true;

    protected $allowedFields = [
        'user_id',
        'type',
        'title',
        'body',
        'entity_id',
        'route',
        'read_at',
    ];

    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = '';

    /**
     * Record a notification. $data may carry type / entity_id / route to populate the typed columns.
     */
    public function recordFor(int $userId, string $title, ?string $body, ?array $data = null): int
    {
        $id = $this->insert([
            'user_id'   => $userId,
            'type'      => $data['type']      ?? null,
            'title'     => $title,
            'body'      => $body,
            'entity_id' => isset($data['entity_id']) ? (int) $data['entity_id'] : null,
            'route'     => $data['route']     ?? null,
        ], true);
        return (int) $id;
    }

    public function listFor(int $userId, int $limit = 50): array
    {
        return $this->where('user_id', $userId)
            ->orderBy('id', 'DESC')
            ->findAll($limit);
    }

    public function markRead(int $userId, int $id): bool
    {
        return $this->where('user_id', $userId)->update($id, ['read_at' => date('Y-m-d H:i:s')]);
    }

    public function unreadCount(int $userId): int
    {
        return $this->where('user_id', $userId)->where('read_at', null)->countAllResults();
    }
}
