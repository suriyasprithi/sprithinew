<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Tokens become fractional so request-approval bonuses (state +3.5%,
 * district +3%, taluk +2%) can credit amounts like 103.50.
 *
 * users.token_balance, distribute_tokens.tokens, token_requests.tokens
 * move INT → DECIMAL(12,2). Existing whole-number rows become x.00.
 */
class TokensToDecimal extends Migration
{
    public function up()
    {
        $this->forge->modifyColumn('users', [
            'token_balance' => ['type' => 'DECIMAL', 'constraint' => '12,2', 'default' => 0],
        ]);
        $this->forge->modifyColumn('distribute_tokens', [
            'tokens' => ['type' => 'DECIMAL', 'constraint' => '12,2', 'default' => 0],
        ]);
        $this->forge->modifyColumn('token_requests', [
            'tokens' => ['type' => 'DECIMAL', 'constraint' => '12,2', 'default' => 0],
        ]);
    }

    public function down()
    {
        // Reverting truncates any fractional tokens back to whole numbers.
        $this->forge->modifyColumn('users', [
            'token_balance' => ['type' => 'INT', 'default' => 0],
        ]);
        $this->forge->modifyColumn('distribute_tokens', [
            'tokens' => ['type' => 'INT', 'default' => 0],
        ]);
        $this->forge->modifyColumn('token_requests', [
            'tokens' => ['type' => 'INT', 'unsigned' => true, 'default' => 0],
        ]);
    }
}
