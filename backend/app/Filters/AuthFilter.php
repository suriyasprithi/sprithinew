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

        $request->user = (object) [
            'id'   => (int) $payload->sub,
            'role' => (string) $payload->role,
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
