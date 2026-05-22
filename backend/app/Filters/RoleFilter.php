<?php

namespace App\Filters;

use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;

class RoleFilter implements FilterInterface
{
    public function before(RequestInterface $request, $arguments = null)
    {
        $user = $request->user ?? null;
        if (! $user) {
            return service('response')->setStatusCode(401)->setJSON([
                'success' => false,
                'message' => 'Unauthorized',
                'error'   => 'no_user',
            ]);
        }
        $allowed = $arguments ?? [];
        if (! empty($allowed) && ! in_array($user->role, $allowed, true)) {
            return service('response')->setStatusCode(403)->setJSON([
                'success' => false,
                'message' => 'Forbidden',
                'error'   => 'role_not_allowed',
            ]);
        }
    }

    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null)
    {
    }
}
