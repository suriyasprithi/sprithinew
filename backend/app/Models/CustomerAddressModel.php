<?php

namespace App\Models;

use CodeIgniter\Model;

class CustomerAddressModel extends Model
{
    protected $table            = 'customer_delivery_addresses';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = false;
    protected $protectFields    = true;

    protected $allowedFields = ['customer_id', 'address_line', 'landmark', 'city', 'pincode', 'is_default'];

    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';

    /** All addresses for a customer, default first then newest. */
    public function forCustomer(int $customerId): array
    {
        return $this->where('customer_id', $customerId)
            ->orderBy('is_default', 'DESC')
            ->orderBy('id', 'DESC')
            ->findAll();
    }

    /** True if this address belongs to the customer. */
    public function ownedBy(int $id, int $customerId): ?array
    {
        return $this->where('id', $id)->where('customer_id', $customerId)->first();
    }

    /**
     * Make one address the customer's default and clear the flag from all
     * others, atomically. Returns true on success.
     */
    public function makeDefault(int $customerId, int $id): bool
    {
        $db = $this->db;
        $db->transStart();
        $db->table($this->table)
            ->where('customer_id', $customerId)
            ->where('id !=', $id)
            ->set('is_default', 0)
            ->set('updated_at', date('Y-m-d H:i:s'))
            ->update();
        $db->table($this->table)
            ->where('customer_id', $customerId)
            ->where('id', $id)
            ->set('is_default', 1)
            ->set('updated_at', date('Y-m-d H:i:s'))
            ->update();
        $db->transComplete();
        return $db->transStatus();
    }

    /** Format an address row into a single delivery line (snapshot for orders). */
    public static function formatLine(array $a): string
    {
        $parts = array_filter([
            $a['address_line'] ?? null,
            ! empty($a['landmark']) ? 'Near ' . $a['landmark'] : null,
            $a['city']    ?? null,
            $a['pincode'] ?? null,
        ]);
        return implode(', ', $parts);
    }
}
