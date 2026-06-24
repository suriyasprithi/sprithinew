<?php

namespace App\Controllers\Api;

use App\Models\DistributeTokenModel;
use App\Models\TokenRequestModel;
use App\Models\UserModel;
use App\Services\NotificationService;
use App\Services\TokenService;
use CodeIgniter\HTTP\ResponseInterface;

class TokenController extends BaseApiController
{
    /**
     * Bank details of the caller's immediate upstream tier — vendor→taluk,
     * taluk→district, district→state, state→admin — so each tier knows where
     * to pay when topping up tokens. Returns { upstream: {...} | null }.
     */
    public function upstreamBank(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);

        $users          = new UserModel();
        $upstreamUserId = null;
        $upstreamRole   = null;

        if ($auth->role === 'vendor') {
            $upstreamRole = 'taluk';
            $prof    = (new \App\Models\VendorProfileModel())->where('user_id', (int) $auth->id)->first();
            $talukId = (int) ($prof['taluk_id'] ?? 0);
            if ($talukId) {
                $taluk = (new \App\Models\TalukModel())->find($talukId);
                $upstreamUserId = (int) ($taluk['user_id'] ?? 0) ?: null;
            }
        } elseif ($auth->role === 'taluk') {
            $upstreamRole = 'district';
            $taluk = (new \App\Models\TalukModel())->where('user_id', (int) $auth->id)->first();
            if ($taluk && ! empty($taluk['district_id'])) {
                $dist = (new \App\Models\DistrictModel())->find((int) $taluk['district_id']);
                $upstreamUserId = (int) ($dist['user_id'] ?? 0) ?: null;
            }
        } elseif ($auth->role === 'district') {
            $upstreamRole = 'state';
            $dist = (new \App\Models\DistrictModel())->where('user_id', (int) $auth->id)->first();
            if ($dist && ! empty($dist['state_id'])) {
                $state = (new \App\Models\StateModel())->find((int) $dist['state_id']);
                $upstreamUserId = (int) ($state['user_id'] ?? 0) ?: null;
            }
        } elseif ($auth->role === 'state') {
            $upstreamRole = 'admin';
            $admin = $users->where('role', 'admin')->where('status', 'active')->orderBy('id', 'ASC')->first();
            $upstreamUserId = $admin ? (int) $admin['id'] : null;
        }

        if (! $upstreamUserId) return $this->ok(['upstream' => null]);
        $u = $users->find($upstreamUserId);
        if (! $u) return $this->ok(['upstream' => null]);

        return $this->ok(['upstream' => [
            'role'           => $upstreamRole,
            'name'           => $u['name'] ?? null,
            'mobile_number'  => $u['mobile_number'] ?? null,
            'account_holder' => $u['account_holder'] ?? null,
            'bank_name'      => $u['bank_name'] ?? null,
            'account_number' => $u['account_number'] ?? null,
            'ifsc_code'      => $u['ifsc_code'] ?? null,
            'upi'            => $u['upi'] ?? null,
        ]]);
    }

    /**
     * Distribute tokens one step down the chain (admin→state→district→taluk→vendor).
     * Markups + balance moves happen inside TokenService::distribute().
     */
    public function distribute(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        if (! in_array($auth->role, ['admin', 'state', 'district', 'taluk'], true)) return $this->fail('Forbidden', 403);

        if (! $this->validate([
            'to_mobile' => 'required|regex_match[/^[0-9]{10}$/]',
            'tokens'    => 'required|integer|greater_than[0]',
        ])) return $this->fail('Validation failed', 422, $this->validator->getErrors());

        $d = $this->request->getJSON(true) ?? $this->request->getPost();
        $users = new UserModel();
        $sender = $users->find($auth->id);
        if (! $sender) return $this->fail('Sender not found', 404);
        $target = $users->where('mobile_number', $d['to_mobile'])->first();
        if (! $target) return $this->fail('Recipient not found', 404);

        try {
            $id = (new TokenService())->distribute(
                $sender, $target, (int) $d['tokens'], $d['notes'] ?? null
            );
        } catch (\DomainException $e) {
            return $this->fail($e->getMessage(), 422);
        } catch (\RuntimeException $e) {
            return $this->fail($e->getMessage(), 500);
        }

        try {
            (new NotificationService())->sendTyped(
                (int) $target['id'], 'token_credit', $id, '/wallet',
                'Tokens received', "{$d['tokens']} tokens from {$sender['name']}"
            );
        } catch (\Throwable $e) {
            log_message('error', 'Token distribute push failed: ' . $e->getMessage());
        }
        return $this->ok(['id' => $id], 'Distributed');
    }

    /** Frontend helper: cost preview for the next hop. */
    public function quote(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        $tokens = (int) ($this->request->getGet('tokens') ?? 0);
        if ($tokens <= 0) return $this->fail('tokens must be positive', 422);
        return $this->ok((new TokenService())->quote($auth->role, $tokens));
    }

    /** Distribute history (issued by me + received by me). */
    public function distributeHistory(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        $issued   = (new DistributeTokenModel())->where('from_user_id', $auth->id)->orderBy('id', 'DESC')->findAll(100);
        $received = (new DistributeTokenModel())->where('to_user_id', $auth->id)->orderBy('id', 'DESC')->findAll(100);

        $userIds = array_unique(array_merge(
            array_map(static fn ($r) => (int) $r['to_user_id'], $issued),
            array_map(static fn ($r) => (int) $r['from_user_id'], $received)
        ));
        $users = $userIds ? (new UserModel())->whereIn('id', $userIds)->findAll() : [];
        $byId = [];
        foreach ($users as $u) $byId[(int) $u['id']] = ['name' => $u['name'], 'mobile_number' => $u['mobile_number']];

        return $this->ok([
            'issued'   => array_map(static fn ($r) => $r + ['peer' => $byId[(int) $r['to_user_id']]   ?? null], $issued),
            'received' => array_map(static fn ($r) => $r + ['peer' => $byId[(int) $r['from_user_id']] ?? null], $received),
        ]);
    }

    /**
     * Vendor (or other downstream role) opens a request.
     * Always starts at current_level='taluk' — the vendor's taluk reviews first.
     * From taluk it can be escalated up the chain.
     */
    public function requestCreate(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        if (! in_array($auth->role, ['vendor', 'taluk', 'district', 'state'], true)) return $this->fail('Forbidden', 403);

        if (! $this->validate([
            'tokens' => 'required|integer|greater_than[0]',
        ])) return $this->fail('Validation failed', 422, $this->validator->getErrors());

        $d = $this->request->getJSON(true) ?? $this->request->getPost();
        // Attachment (payment proof) is mandatory for every requester role.
        if (empty($d['attachment'])) {
            return $this->fail('An attachment (payment proof) is required', 422);
        }

        // Where does the request enter the chain? Vendor → taluk; taluk → district; district → state; state → admin.
        $startLevel = match ($auth->role) {
            'vendor'   => 'taluk',
            'taluk'    => 'district',
            'district' => 'state',
            'state'    => 'admin',
            default    => 'taluk',
        };

        $reqModel = new TokenRequestModel();
        $id = $reqModel->insert([
            'requester_id'   => $auth->id,
            'amount'         => (float) ($d['amount'] ?? 0),
            'tokens'         => (int) $d['tokens'],
            'status'         => 'pending',
            'current_level'  => $startLevel,
            'notes'          => $d['notes'] ?? null,
            'attachment'     => $d['attachment'] ?? null,
        ], true);

        $this->logEvent((int) $id, (int) $auth->id, 'create', null, $startLevel, $d['notes'] ?? null);

        try {
            $fromLabel = ucfirst((string) $auth->role);
            // $auth is a stdClass with only id+role from the JWT; look up the
            // requester's name from the DB so the notification body has it.
            $requester     = (new \App\Models\UserModel())->find((int) $auth->id);
            $requesterName = $requester['name'] ?? $fromLabel;
            $title         = "New token request from {$fromLabel}";
            $body          = "{$d['tokens']} tokens requested by {$requesterName}";

            // Find the SPECIFIC upstream user for this requester. Falls back to
            // a role-wide broadcast (e.g. admins) if no specific user found.
            $targetUserId = null;
            $db = \Config\Database::connect();
            if ($auth->role === 'vendor') {
                $row = $db->query(
                    'SELECT t.user_id FROM vendor_profiles vp JOIN taluks t ON t.id = vp.taluk_id WHERE vp.user_id = ? LIMIT 1',
                    [(int) $auth->id]
                )->getRow();
                if ($row) $targetUserId = (int) $row->user_id;
            } elseif ($auth->role === 'taluk') {
                $row = $db->query(
                    'SELECT d.user_id FROM taluks t JOIN districts d ON d.id = t.district_id WHERE t.user_id = ? LIMIT 1',
                    [(int) $auth->id]
                )->getRow();
                if ($row) $targetUserId = (int) $row->user_id;
            } elseif ($auth->role === 'district') {
                $row = $db->query(
                    'SELECT s.user_id FROM districts d JOIN states s ON s.id = d.state_id WHERE d.user_id = ? LIMIT 1',
                    [(int) $auth->id]
                )->getRow();
                if ($row) $targetUserId = (int) $row->user_id;
            }

            if ($targetUserId) {
                (new NotificationService())->sendTyped(
                    $targetUserId, 'token_request', (int) $id, '/tokens', $title, $body
                );
            } else {
                // Fallback: broadcast to whole upstream role (e.g. admins for state requests).
                (new NotificationService())->sendTypedToRole(
                    $startLevel, 'token_request', (int) $id, '/tokens', $title, $body
                );
            }
        } catch (\Throwable $e) { log_message('error', 'Token request push failed: ' . $e->getMessage()); }

        // Self-notification so the requester sees their own request in their
        // activity feed (legacy parity: "You Requested N Points").
        try {
            (new NotificationService())->sendTyped(
                (int) $auth->id, 'token_request', (int) $id, '/token-request',
                'Token request submitted',
                "You requested {$d['tokens']} tokens"
            );
        } catch (\Throwable $e) { log_message('error', 'Token request self-notify failed: ' . $e->getMessage()); }

        return $this->ok(['id' => (int) $id, 'current_level' => $startLevel], 'Submitted');
    }

    /** Upload an optional proof (image/PDF) for a token request — returns its path + url. */
    public function requestUpload(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);

        $file = $this->request->getFile('file');
        if (! $file || ! $file->isValid() || $file->hasMoved()) return $this->fail('No file uploaded', 422);
        if ($file->getSize() > 5 * 1024 * 1024) return $this->fail('File must be 5 MB or smaller', 422);
        $allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
        if (! in_array($file->getMimeType(), $allowed, true)) {
            return $this->fail('File must be a JPG, PNG, WEBP or PDF', 422);
        }

        $dir = FCPATH . 'uploads/token-requests/';
        if (! is_dir($dir)) @mkdir($dir, 0775, true);
        $name = $file->getRandomName();
        $file->move($dir, $name);
        $path = 'uploads/token-requests/' . $name;

        return $this->ok(['path' => $path, 'url' => base_url($path)], 'Uploaded');
    }

    /**
     * Requests for the user's Token Requests page.
     *
     * Returns:
     *   (a) PENDING items waiting on me to act on (current_level = my role and
     *       requester role matches the immediate-below filter), AND
     *   (b) any historical items where I am the processor (processed_by = me).
     *
     * Combined so the stat cards (Total / Pending / Approved / Tokens approved)
     * reflect both the open queue and my completed actions.
     */
    public function inbox(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        if (! in_array($auth->role, ['taluk', 'district', 'state', 'admin'], true)) return $this->fail('Forbidden', 403);

        // Each non-admin level only sees pending requests originating from the
        // role directly below it. Admin sees all pending at its current_level.
        $immediateBelow = [
            'taluk'    => 'vendor',
            'district' => 'taluk',
            'state'    => 'district',
        ];

        $db = \Config\Database::connect();

        // (a) Pending items waiting on me
        $pendingIdsQuery = (new TokenRequestModel())
            ->where('status', 'pending')
            ->where('current_level', $auth->role);

        if (isset($immediateBelow[$auth->role])) {
            $expectedRequesterRole = $immediateBelow[$auth->role];
            $eligibleRequesterIds  = (new UserModel())
                ->where('role', $expectedRequesterRole)
                ->findColumn('id') ?: [];
            if (empty($eligibleRequesterIds)) {
                // No eligible pending — fall through to history-only.
                $pendingRows = [];
            } else {
                $pendingIdsQuery->whereIn('requester_id', $eligibleRequesterIds);
                $pendingRows = $pendingIdsQuery->orderBy('id', 'DESC')->findAll(100);
            }
        } else {
            $pendingRows = $pendingIdsQuery->orderBy('id', 'DESC')->findAll(100);
        }

        // (b) Anything I've already processed (approved / rejected)
        $processedRows = (new TokenRequestModel())
            ->where('processed_by', $auth->id)
            ->orderBy('id', 'DESC')->findAll(100);

        // Merge, dedupe by id, newest first
        $merged = [];
        foreach (array_merge($pendingRows, $processedRows) as $r) {
            $merged[(int) $r['id']] = $r;
        }
        krsort($merged);
        $rows = array_values($merged);

        $ids = array_unique(array_map(static fn ($r) => (int) $r['requester_id'], $rows));
        $users = $ids ? (new UserModel())->whereIn('id', $ids)->findAll() : [];
        $byId  = [];
        foreach ($users as $u) $byId[(int) $u['id']] = ['name' => $u['name'], 'mobile_number' => $u['mobile_number'], 'role' => $u['role']];
        $items = array_map(static fn ($r) => $r + [
            'requester'      => $byId[(int) $r['requester_id']] ?? null,
            'attachment_url' => ! empty($r['attachment']) ? base_url($r['attachment']) : null,
        ], $rows);
        return $this->ok(['items' => $items]);
    }

    /** Approver fulfils the request. Tokens flow down the chain to the vendor. */
    public function requestApprove(int $id): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);

        $reqModel = new TokenRequestModel();
        $row = $reqModel->find($id);
        if (! $row) return $this->fail('Not found', 404);
        if ($row['status'] !== 'pending') return $this->fail('Already processed', 409);
        if ($row['current_level'] !== $auth->role) {
            return $this->fail("This request is waiting on a {$row['current_level']} approver", 403);
        }

        $users    = new UserModel();
        $approver = $users->find($auth->id);
        $vendor   = $users->find((int) $row['requester_id']);
        if (! $vendor) return $this->fail('Requester not found', 404);

        try {
            $result = (new TokenService())->fulfillRequest($approver, $vendor, (float) $row['tokens'], "request#{$id}");
        } catch (\DomainException $e) {
            return $this->fail($e->getMessage(), 422);
        } catch (\RuntimeException $e) {
            return $this->fail($e->getMessage(), 500);
        }

        $reqModel->update($id, [
            'status'        => 'approved',
            'current_level' => 'done',
            'processed_by'  => $auth->id,
        ]);
        $this->logEvent($id, (int) $auth->id, 'approve', $auth->role, 'done', null);

        try {
            $approverLabel = ucfirst((string) $auth->role);
            $credited = rtrim(rtrim(number_format($result['credited'], 2, '.', ''), '0'), '.');
            $body     = $result['bonus'] > 0
                ? "{$credited} tokens credited (incl {$result['bonus']} bonus @ {$result['bonus_pct']}%)"
                : "{$credited} tokens credited to your wallet";
            (new NotificationService())->sendTyped(
                (int) $vendor['id'], 'token_credit', $id, '/tokens',
                "Token request approved by {$approverLabel}",
                $body
            );
        } catch (\Throwable $e) { log_message('error', 'Token approve push failed: ' . $e->getMessage()); }

        return $this->ok(null, 'Approved');
    }

    /** Escalation disabled — each level only handles its immediate-below role. */
    public function requestEscalate(int $id): ResponseInterface
    {
        return $this->fail('Escalation is disabled. Reject the request, or create your own request to the level above for more tokens.', 405);
        // (Kept method body below for reference; unreachable.)
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);

        $next = match ($auth->role) {
            'taluk'    => 'district',
            'district' => 'state',
            'state'    => 'admin',
            default    => null,
        };
        if (! $next) return $this->fail('Cannot escalate from your role', 403);

        $reqModel = new TokenRequestModel();
        $row = $reqModel->find($id);
        if (! $row) return $this->fail('Not found', 404);
        if ($row['status'] !== 'pending') return $this->fail('Already processed', 409);
        if ($row['current_level'] !== $auth->role) {
            return $this->fail("This request is waiting on a {$row['current_level']} approver", 403);
        }

        $d = $this->request->getJSON(true) ?? $this->request->getPost();
        $notes = trim((string) ($d['notes'] ?? ''));

        $reqModel->update($id, ['current_level' => $next]);
        $this->logEvent($id, (int) $auth->id, 'escalate', $auth->role, $next, $notes ?: null);

        $fromLabel = ucfirst((string) $auth->role);
        $toLabel   = ucfirst($next);

        try {
            // Notify the next level — show where it came from.
            (new NotificationService())->sendTypedToRole($next, 'token_request', $id, '/tokens',
                "Escalated token request from {$fromLabel}",
                "{$row['tokens']} tokens — review"
            );
            // Also notify the original requester so they see the progress.
            (new NotificationService())->sendTyped(
                (int) $row['requester_id'], 'token_request', $id, '/tokens',
                "Token request escalated to {$toLabel}",
                "{$fromLabel} forwarded your request for review"
            );
        } catch (\Throwable $e) { log_message('error', 'Token escalate push failed: ' . $e->getMessage()); }

        return $this->ok(['current_level' => $next], 'Escalated');
    }

    /** Reject a request. The approver currently responsible (current_level == role) or admin. */
    public function requestReject(int $id): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        if (! in_array($auth->role, ['taluk', 'district', 'state', 'admin'], true)) return $this->fail('Forbidden', 403);

        $reqModel = new TokenRequestModel();
        $row = $reqModel->find($id);
        if (! $row) return $this->fail('Not found', 404);
        if ($row['status'] !== 'pending') return $this->fail('Already processed', 409);
        // Only the level currently responsible may reject (admin can reject anything).
        if ($auth->role !== 'admin' && $row['current_level'] !== $auth->role) {
            return $this->fail("This request is waiting on a {$row['current_level']} approver", 403);
        }

        $reqModel->update($id, [
            'status'        => 'rejected',
            'current_level' => 'rejected',
            'processed_by'  => $auth->id,
        ]);
        $this->logEvent($id, (int) $auth->id, 'reject', $row['current_level'], 'rejected', null);

        try {
            $rejecterLabel = ucfirst((string) $auth->role);
            (new NotificationService())->sendTyped(
                (int) $row['requester_id'], 'token_credit', $id, '/tokens',
                "Token request rejected by {$rejecterLabel}",
                "Your {$row['tokens']}-token request was declined"
            );
        } catch (\Throwable $e) { log_message('error', 'Token reject push failed: ' . $e->getMessage()); }

        return $this->ok(null, 'Rejected');
    }

    /** Admin-only: manually credit any user with N tokens (no ₹ cost, no markup). */
    public function adminCredit(): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;
        $auth = $this->authUser();

        if (! $this->validate([
            'to_mobile' => 'required|regex_match[/^[0-9]{10}$/]',
            'tokens'    => 'required|integer|greater_than[0]',
        ])) return $this->fail('Validation failed', 422, $this->validator->getErrors());

        $d        = $this->request->getJSON(true) ?? $this->request->getPost();
        $users    = new UserModel();
        $sender   = $users->find($auth->id);
        $target   = $users->where('mobile_number', $d['to_mobile'])->first();
        if (! $target) return $this->fail('Recipient not found', 404);

        try {
            $ledgerId = (new TokenService())->gift($sender, $target, (int) $d['tokens'], $d['notes'] ?? 'Admin manual credit');
        } catch (\DomainException $e) {
            return $this->fail($e->getMessage(), 422);
        }

        return $this->ok(['id' => $ledgerId], 'Credited');
    }

    /** Get full event timeline for a request (audit log + current state). */
    public function requestShow(int $id): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);

        $req = (new TokenRequestModel())->find($id);
        if (! $req) return $this->fail('Not found', 404);

        $isRequester = (int) $req['requester_id'] === (int) $auth->id;
        $canSee = $isRequester || in_array($auth->role, ['admin', 'state', 'district', 'taluk'], true);
        if (! $canSee) return $this->fail('Forbidden', 403);

        $db = \Config\Database::connect();
        $events = $db->query(
            'SELECT e.*, u.name AS actor_name, u.role AS actor_role
             FROM token_request_events e
             LEFT JOIN users u ON u.id = e.actor_id
             WHERE e.request_id = ?
             ORDER BY e.id ASC',
            [$id]
        )->getResultArray();
        $req['attachment_url'] = ! empty($req['attachment']) ? base_url($req['attachment']) : null;
        return $this->ok(['request' => $req, 'events' => $events]);
    }

    private function logEvent(int $reqId, int $actorId, string $action, ?string $from, ?string $to, ?string $notes): void
    {
        \Config\Database::connect()->table('token_request_events')->insert([
            'request_id' => $reqId,
            'actor_id'   => $actorId,
            'action'     => $action,
            'from_level' => $from,
            'to_level'   => $to,
            'notes'      => $notes,
            'created_at' => date('Y-m-d H:i:s'),
        ]);
    }

    public function requestMine(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        $rows = (new TokenRequestModel())->where('requester_id', $auth->id)->orderBy('id', 'DESC')->findAll(100);
        $rows = array_map(static fn ($r) => $r + ['attachment_url' => ! empty($r['attachment']) ? base_url($r['attachment']) : null], $rows);
        return $this->ok(['items' => $rows]);
    }

    public function requestUpdate(int $id): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        $model = new TokenRequestModel();
        $row = $model->find($id);
        if (! $row || (int) $row['requester_id'] !== (int) $auth->id) return $this->fail('Not found', 404);
        if ($row['status'] !== 'pending') return $this->fail('Locked', 409);
        $d = $this->request->getJSON(true) ?? $this->request->getPost();
        $payload = array_intersect_key($d, array_flip(['amount', 'tokens', 'notes']));
        if (! $payload) return $this->fail('Nothing to update', 422);
        $model->update($id, $payload);
        return $this->ok(null, 'Updated');
    }

    public function requestCancel(int $id): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        $model = new TokenRequestModel();
        $row = $model->find($id);
        if (! $row || (int) $row['requester_id'] !== (int) $auth->id) return $this->fail('Not found', 404);
        if ($row['status'] !== 'pending') return $this->fail('Locked', 409);
        $model->update($id, ['status' => 'cancelled', 'current_level' => 'rejected']);
        return $this->ok(null, 'Cancelled');
    }

    /** Admin: list state → admin requests + approve/reject. */
    public function adminRequests(): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;

        // Admin only handles requests that originate from a state user
        // (state → admin). Lower-level requests (vendor/taluk/district) are
        // handled by their own upstream approver, so they never show here.
        $stateIds = (new UserModel())->where('role', 'state')->findColumn('id') ?: [];
        if (empty($stateIds)) return $this->ok(['items' => []]);

        $rows = (new TokenRequestModel())
            ->whereIn('requester_id', $stateIds)
            ->orderBy('id', 'DESC')->findAll(200);
        $ids = array_unique(array_map(static fn ($r) => (int) $r['requester_id'], $rows));
        $users = $ids ? (new UserModel())->whereIn('id', $ids)->findAll() : [];
        $byId = [];
        foreach ($users as $u) $byId[(int) $u['id']] = ['name' => $u['name'], 'mobile_number' => $u['mobile_number'], 'role' => $u['role']];
        $items = array_map(static fn ($r) => $r + [
            'requester'      => $byId[(int) $r['requester_id']] ?? null,
            'attachment_url' => ! empty($r['attachment']) ? base_url($r['attachment']) : null,
        ], $rows);
        return $this->ok(['items' => $items]);
    }

    public function adminProcess(int $id): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;
        $auth = $this->authUser();
        $action = $this->request->getJSON(true)['action'] ?? $this->request->getPost('action');
        if (! in_array($action, ['approve', 'reject'], true)) return $this->fail('Invalid action', 422);

        $model = new TokenRequestModel();
        $row = $model->find($id);
        if (! $row) return $this->fail('Not found', 404);
        if ($row['status'] !== 'pending') return $this->fail('Already processed', 409);

        $status = $action === 'approve' ? 'approved' : 'rejected';
        $model->update($id, ['status' => $status, 'processed_by' => $auth->id]);

        if ($status === 'approved') {
            // Auto-distribute tokens upon approval
            (new DistributeTokenModel())->insert([
                'from_user_id' => $auth->id,
                'to_user_id'   => (int) $row['requester_id'],
                'amount'       => (float) $row['amount'],
                'tokens'       => (int) $row['tokens'],
                'notes'        => 'Auto-issued on request#' . $id,
            ]);
        }
        try {
            (new NotificationService())->sendTyped(
                (int) $row['requester_id'], 'token_credit', $id, '/wallet',
                "Token request {$status}", '₹' . $row['amount']
            );
        } catch (\Throwable $e) {
            log_message('error', 'Token request process push failed: ' . $e->getMessage());
        }
        return $this->ok(null, $status);
    }

    private function requireAdmin(): ?ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        if ($auth->role !== 'admin') return $this->fail('Forbidden', 403);
        return null;
    }
}
