<?php

namespace App\Services;

use App\Models\DeviceTokenModel;
use App\Models\NotificationModel;
use App\Models\UserModel;

class NotificationService
{
    public function sendToUser(int $userId, string $title, ?string $body = null, ?array $data = null): array
    {
        $notifId = (new NotificationModel())->recordFor($userId, $title, $body, $data);

        // Only push to native devices. Web stub tokens are kept in the table for
        // identity continuity but are not valid FCM tokens; sending them would
        // always 404 at FCM and inflate the failure count.
        $tokens = (new DeviceTokenModel())
            ->where('user_id', $userId)
            ->whereIn('platform', ['android', 'ios'])
            ->findAll();
        if (! $tokens) {
            return ['notification_id' => $notifId, 'sent' => 0, 'tokens' => 0];
        }

        $fcm  = new FirebaseService();
        $sent = 0;
        foreach ($tokens as $t) {
            if ($fcm->sendToToken($t['token'], $title, $body, $data)) $sent++;
        }
        return ['notification_id' => $notifId, 'sent' => $sent, 'tokens' => count($tokens)];
    }

    public function sendToRole(string $role, string $title, ?string $body = null, ?array $data = null): array
    {
        $users = (new UserModel())->where('role', $role)->where('status', 'active')->findAll();
        $totals = ['sent' => 0, 'tokens' => 0, 'users' => count($users)];
        foreach ($users as $u) {
            $r = $this->sendToUser((int) $u['id'], $title, $body, $data);
            $totals['sent']   += $r['sent'];
            $totals['tokens'] += $r['tokens'];
        }
        return $totals;
    }

    /**
     * Typed push for deep-link routing.
     * Payload shape sent to FCM data:
     *   { type, entity_id, route }
     * Frontend tap handler reads data.route and navigates there.
     */
    public function sendTyped(int $userId, string $type, int $entityId, string $route, string $title, ?string $body = null): array
    {
        return $this->sendToUser($userId, $title, $body, [
            'type'      => $type,
            'entity_id' => (string) $entityId,
            'route'     => $route,
        ]);
    }

    public function sendTypedToRole(string $role, string $type, int $entityId, string $route, string $title, ?string $body = null): array
    {
        return $this->sendToRole($role, $title, $body, [
            'type'      => $type,
            'entity_id' => (string) $entityId,
            'route'     => $route,
        ]);
    }
}
