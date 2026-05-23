<?php

namespace App\Commands;

use App\Services\NotificationService;
use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;

/**
 * Send a test push notification to a single user.
 *
 *   php spark push:test 6                                 # default title/body
 *   php spark push:test 6 "Custom title" "Custom body"
 *
 * Requires backend/writable/firebase-service-account.json to be present and
 * firebase.credentials set in .env.
 */
class PushTest extends BaseCommand
{
    protected $group       = 'epey';
    protected $name        = 'push:test';
    protected $description = 'Send a test push notification to a user via FCM';
    protected $usage       = 'php spark push:test <user_id> [title] [body]';
    protected $arguments   = [
        'user_id' => 'Target user id',
        'title'   => '(optional) Notification title',
        'body'    => '(optional) Notification body',
    ];

    public function run(array $params)
    {
        $userId = (int) ($params[0] ?? 0);
        if ($userId <= 0) {
            CLI::error('Usage: php spark push:test <user_id> [title] [body]');
            return;
        }
        $title = $params[1] ?? '🔔 Test Push';
        $body  = $params[2] ?? 'Hello from Firebase Admin SDK!';

        CLI::write("Sending push to user_id={$userId} …");
        $svc = new NotificationService();
        $r = $svc->sendToUser($userId, $title, $body, ['route' => '/notifications', 'kind' => 'test']);

        CLI::write('');
        CLI::write('Result:');
        CLI::write('  notification_id : ' . ($r['notification_id'] ?? '(n/a)'));
        CLI::write('  tokens found    : ' . ($r['tokens'] ?? 0));
        CLI::write('  pushes sent     : ' . ($r['sent'] ?? 0));

        if (($r['tokens'] ?? 0) === 0) {
            CLI::write('');
            CLI::error('No android/ios tokens registered for that user — sign in on the APK first.');
        } elseif (($r['sent'] ?? 0) === 0) {
            CLI::write('');
            CLI::error('Tokens exist but FCM rejected the send. Check backend/writable/logs/log-*.log for "FCM send failed" lines.');
        } else {
            CLI::write('');
            CLI::write(CLI::color('✓ Push fired to FCM successfully.', 'green'));
            CLI::write('Check the phone notification tray in 1–3 seconds.');
        }
    }
}
