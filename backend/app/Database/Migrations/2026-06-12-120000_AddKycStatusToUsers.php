<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * KYC for withdrawals: a one-time verification status + the bank account-holder
 * name. The document columns themselves (aadhar, aadhar_image, pan, pan_image,
 * bank_name, account_number, ifsc_code, upi) already exist from the legacy
 * import — this only adds what's missing.
 */
class AddKycStatusToUsers extends Migration
{
    public function up()
    {
        $fields = [];
        if (! $this->db->fieldExists('kyc_status', 'users')) {
            $fields['kyc_status'] = ['type' => 'VARCHAR', 'constraint' => 20, 'default' => 'none', 'null' => false];
        }
        if (! $this->db->fieldExists('kyc_note', 'users')) {
            $fields['kyc_note'] = ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true];
        }
        if (! $this->db->fieldExists('account_holder', 'users')) {
            $fields['account_holder'] = ['type' => 'VARCHAR', 'constraint' => 150, 'null' => true];
        }
        if ($fields) {
            $this->forge->addColumn('users', $fields);
        }
    }

    public function down()
    {
        foreach (['kyc_status', 'kyc_note', 'account_holder'] as $col) {
            if ($this->db->fieldExists($col, 'users')) {
                $this->forge->dropColumn('users', $col);
            }
        }
    }
}
