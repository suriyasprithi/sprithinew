<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateSystemSettingsTable extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'setting_key' => ['type' => 'VARCHAR', 'constraint' => 80],
            'value'       => ['type' => 'TEXT', 'null' => true],
            'updated_at'  => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addPrimaryKey('setting_key');
        $this->forge->createTable('system_settings');

        $now      = date('Y-m-d H:i:s');
        $defaults = [
            'delivery.base_fee'              => '0',
            'delivery.rate_per_km'           => '5',
            'delivery.rate_per_hour'         => '30',
            'token.low_threshold'            => '50',
            'token.allow_negative_balance'   => '0',
            'welcome.bonus_amount'           => '15',
            'welcome.bonus_active'           => '1',
            'referral.no_referral_days'      => '90',
            'level.unlock_threshold_1'       => '100',
            'level.unlock_threshold_2'       => '10000',
            'level.unlock_threshold_3'       => '100000',
            'buyback.slot_1_pct'             => '15',
            'buyback.slot_2_pct'             => '10',
            'buyback.slot_3_pct'             => '5',
            'buyback.slot_4_pct'             => '2.5',
            'geo.taluk_pct'                  => '2',
            'geo.district_pct'               => '1',
            'geo.state_pct'                  => '1',
            'mlm.level_1_pct'                => '25',
            'mlm.level_2_pct'                => '10',
            'mlm.level_3_pct'                => '1.5',
            'mlm.global_pct'                 => '2.5',
            'token.markup_taluk_pct'         => '2',
            'token.markup_district_pct'      => '1',
            'token.markup_state_pct'         => '1',
        ];
        $rows = [];
        foreach ($defaults as $k => $v) {
            $rows[] = ['setting_key' => $k, 'value' => $v, 'updated_at' => $now];
        }
        $this->db->table('system_settings')->insertBatch($rows);
    }

    public function down()
    {
        $this->forge->dropTable('system_settings', true);
    }
}
