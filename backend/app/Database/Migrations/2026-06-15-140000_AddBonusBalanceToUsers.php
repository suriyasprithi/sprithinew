<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddBonusBalanceToUsers extends Migration
{
    // Per-user "bonus pot" for the siphon-down-the-chain token-request model:
    // a requester draws its role-% out of the upline's bonus_balance on approval.
    public function up()
    {
        if (! $this->db->fieldExists('bonus_balance', 'users')) {
            $this->forge->addColumn('users', [
                'bonus_balance' => [
                    'type'       => 'DECIMAL',
                    'constraint' => '12,2',
                    'default'    => 0.00,
                    'after'      => 'token_balance',
                ],
            ]);
            // Seed each user's pot from the bonuses they've already received, so
            // the existing "Bonus earned" figure carries over as the starting pot.
            $this->db->query(
                'UPDATE users u
                 SET bonus_balance = (
                     SELECT COALESCE(SUM(bonus), 0) FROM distribute_tokens d
                     WHERE d.to_user_id = u.id AND d.bonus <> 0
                 )'
            );
        }
    }

    public function down()
    {
        if ($this->db->fieldExists('bonus_balance', 'users')) {
            $this->forge->dropColumn('users', 'bonus_balance');
        }
    }
}
