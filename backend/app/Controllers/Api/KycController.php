<?php

namespace App\Controllers\Api;

use App\Models\UserModel;
use App\Services\NotificationService;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Customer KYC for withdrawals.
 *
 *  - upload():  store an Aadhaar/PAN image under public/uploads/kyc, return its URL.
 *  - mine():    the signed-in customer's KYC + status.
 *  - save():    submit KYC (Aadhaar/PAN/bank); flips kyc_status to 'pending'.
 *  - Admin:     pending(), verify(), reject() — one-time verification flow.
 *
 * Withdrawals are gated on kyc_status = 'verified' (see WithdrawalController).
 */
class KycController extends BaseApiController
{
    /** Fields required before KYC can be submitted. */
    private const REQUIRED = ['aadhar', 'aadhar_image', 'pan', 'pan_image', 'account_holder', 'account_number', 'ifsc_code'];

    public function upload(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);

        $file = $this->request->getFile('image');
        if (! $file || ! $file->isValid() || $file->hasMoved()) return $this->fail('No image uploaded', 422);
        if ($file->getSize() > 5 * 1024 * 1024) return $this->fail('Image must be 5 MB or smaller', 422);
        if (! in_array($file->getMimeType(), ['image/jpeg', 'image/png', 'image/webp'], true)) {
            return $this->fail('Image must be a JPG, PNG or WEBP', 422);
        }

        $dir = FCPATH . 'uploads/kyc/';
        if (! is_dir($dir)) @mkdir($dir, 0775, true);
        $name = $file->getRandomName();
        $file->move($dir, $name);
        $path = 'uploads/kyc/' . $name;

        return $this->ok(['path' => $path, 'url' => base_url($path)], 'Uploaded');
    }

    public function mine(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        $u = (new UserModel())->find($auth->id);
        return $this->ok($this->payload($u));
    }

    public function save(): ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        $d = $this->request->getJSON(true) ?? $this->request->getPost() ?? [];

        foreach (self::REQUIRED as $f) {
            if (trim((string) ($d[$f] ?? '')) === '') {
                return $this->fail('All ID documents and bank details are required', 422);
            }
        }

        (new UserModel())->update($auth->id, [
            'aadhar'         => trim((string) $d['aadhar']),
            'aadhar_image'   => trim((string) $d['aadhar_image']),
            'pan'            => trim((string) $d['pan']),
            'pan_image'      => trim((string) $d['pan_image']),
            'account_holder' => trim((string) $d['account_holder']),
            'account_number' => trim((string) $d['account_number']),
            'ifsc_code'      => trim((string) $d['ifsc_code']),
            'bank_name'      => trim((string) ($d['bank_name'] ?? '')) ?: null,
            'upi'            => trim((string) ($d['upi'] ?? '')) ?: null,
            'kyc_status'     => 'pending',
            'kyc_note'       => null,
        ]);

        return $this->ok(['kyc_status' => 'pending'], 'KYC submitted for verification');
    }

    // ───────────────────────── Admin ─────────────────────────

    public function pending(): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;
        $rows = (new UserModel())->where('kyc_status', 'pending')->orderBy('updated_at', 'DESC')->findAll(200);
        $items = array_map(fn ($u) => $this->payload($u) + [
            'id'            => (int) $u['id'],
            'name'          => $u['name'],
            'mobile_number' => $u['mobile_number'],
        ], $rows);
        return $this->ok(['items' => $items]);
    }

    public function verify(int $id): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;
        $users = new UserModel();
        $u = $users->find($id);
        if (! $u) return $this->fail('Not found', 404);
        $users->update($id, ['kyc_status' => 'verified', 'kyc_note' => null]);
        $this->notify($id, 'KYC verified', 'Your documents are verified — you can now withdraw.');
        return $this->ok(null, 'Verified');
    }

    public function reject(int $id): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;
        $note = trim((string) ($this->request->getJSON(true)['note'] ?? $this->request->getPost('note') ?? ''));
        $users = new UserModel();
        $u = $users->find($id);
        if (! $u) return $this->fail('Not found', 404);
        $users->update($id, ['kyc_status' => 'rejected', 'kyc_note' => $note ?: null]);
        $this->notify($id, 'KYC rejected', $note ?: 'Please re-submit your documents.');
        return $this->ok(null, 'Rejected');
    }

    // ───────────────────────── helpers ─────────────────────────

    private function payload(?array $u): array
    {
        $u = $u ?? [];
        $url = static fn ($p) => $p ? base_url($p) : null;
        return [
            'aadhar'           => $u['aadhar'] ?? null,
            'aadhar_image'     => $u['aadhar_image'] ?? null,        // raw path (kept for re-save)
            'aadhar_image_url' => $url($u['aadhar_image'] ?? null),  // display URL
            'pan'              => $u['pan'] ?? null,
            'pan_image'        => $u['pan_image'] ?? null,
            'pan_image_url'    => $url($u['pan_image'] ?? null),
            'account_holder' => $u['account_holder'] ?? null,
            'account_number' => $u['account_number'] ?? null,
            'ifsc_code'      => $u['ifsc_code'] ?? null,
            'bank_name'      => $u['bank_name'] ?? null,
            'upi'            => $u['upi'] ?? null,
            'kyc_status'     => $u['kyc_status'] ?? 'none',
            'kyc_note'       => $u['kyc_note'] ?? null,
        ];
    }

    private function notify(int $userId, string $title, string $body): void
    {
        try {
            (new NotificationService())->sendTyped($userId, 'kyc_status', $userId, '/profile/kyc', $title, $body);
        } catch (\Throwable $e) {
            log_message('error', 'KYC notify failed: ' . $e->getMessage());
        }
    }

    private function requireAdmin(): ?ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth) return $this->fail('Unauthorized', 401);
        if ($auth->role !== 'admin') return $this->fail('Forbidden', 403);
        return null;
    }
}
