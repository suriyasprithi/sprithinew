<?php

namespace App\Controllers\Api;

use CodeIgniter\Controller;
use CodeIgniter\HTTP\ResponseInterface;

abstract class BaseApiController extends Controller
{
    protected function ok($data = null, string $message = 'OK', int $status = 200): ResponseInterface
    {
        return $this->response->setStatusCode($status)->setJSON([
            'success' => true,
            'message' => $message,
            'data'    => $data,
        ]);
    }

    protected function fail(string $message, int $status = 400, $errors = null): ResponseInterface
    {
        return $this->response->setStatusCode($status)->setJSON([
            'success' => false,
            'message' => $message,
            'errors'  => $errors,
        ]);
    }

    protected function authUser(): ?object
    {
        return $this->request->user ?? null;
    }

    /** Returns ['page' => int, 'perPage' => int, 'offset' => int]. */
    protected function paging(int $defaultPerPage = 20, int $maxPerPage = 100): array
    {
        $page    = max(1, (int) ($this->request->getGet('page') ?: 1));
        $perPage = min($maxPerPage, max(1, (int) ($this->request->getGet('per_page') ?: $defaultPerPage)));
        return ['page' => $page, 'perPage' => $perPage, 'offset' => ($page - 1) * $perPage];
    }
}
