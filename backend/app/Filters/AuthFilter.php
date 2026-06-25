<?php

namespace App\Filters;

use App\Services\JwtService;
use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;

class AuthFilter implements FilterInterface
{
    public function before(RequestInterface $request, $arguments = null)
    {
        $auth = $request->getHeaderLine('Authorization');
        if ($auth === '' || stripos($auth, 'Bearer ') !== 0) {
            return $this->unauthorized('missing_token');
        }
        $token = trim(substr($auth, 7));
        if ($token === '') {
            return $this->unauthorized('missing_token');
        }

        $jwt = new JwtService();
        $result = $jwt->decode($token);
        if (! $result['ok']) {
            return $this->unauthorized($result['error'] ?? 'invalid_token');
        }
        $payload = $result['payload'];
        if (($payload->typ ?? '') !== 'access') {
            return $this->unauthorized('invalid_token_type');
        }

        // Re-validate against the DB each request: stateless JWTs otherwise stay
        // valid until expiry (and the refresh token is long-lived), so a blocked /
        // deactivated or role-changed user would keep full access. One indexed PK
        // lookup; the CURRENT role is used (not the token's) so a demotion applies
        // immediately. Only explicit blocked/inactive is rejected — NULL/active
        // pass, so legacy rows aren't locked out.
        $row = \Config\Database::connect()
            ->table('users')->select('id, role, status')
            ->where('id', (int) $payload->sub)
            ->get()->getRowArray();
        if (! $row) {
            return $this->unauthorized('user_not_found');
        }
        if (in_array(($row['status'] ?? 'active'), ['blocked', 'inactive'], true)) {
            return $this->unauthorized('account_inactive');
        }

        $request->user = (object) [
            'id'   => (int) $row['id'],
            'role' => (string) $row['role'],
        ];
    }

    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null)
    {
    }

    private function unauthorized(string $reason)
    {
        return service('response')
            ->setStatusCode(401)
            ->setJSON([
                'success' => false,
                'message' => 'Unauthorized',
                'error'   => $reason,
            ]);
    }
}
