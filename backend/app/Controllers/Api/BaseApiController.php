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

    /**
     * Robust JSON body reader. CodeIgniter's getJSON() THROWS on a malformed
     * payload (a stray control char or bad UTF-8 anywhere makes the whole body
     * invalid), 500-ing the request. This reads the raw body, strips raw control
     * chars, substitutes invalid UTF-8, then decodes — falling back to form post.
     * Always returns an array, never throws.
     */
    protected function jsonBody(): array
    {
        $raw = (string) $this->request->getBody();
        if (trim($raw) !== '') {
            // Strip raw control chars (keep \t \n \r) that aren't valid in JSON
            // strings, then decode with bad-UTF-8 substitution.
            $clean   = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', '', $raw);
            $decoded = json_decode((string) $clean, true, 512, JSON_INVALID_UTF8_SUBSTITUTE);
            if (is_array($decoded)) return $decoded;
        }
        $post = $this->request->getPost();
        return is_array($post) ? $post : [];
    }

    /** Returns ['page' => int, 'perPage' => int, 'offset' => int]. */
    protected function paging(int $defaultPerPage = 20, int $maxPerPage = 100): array
    {
        $page    = max(1, (int) ($this->request->getGet('page') ?: 1));
        $perPage = min($maxPerPage, max(1, (int) ($this->request->getGet('per_page') ?: $defaultPerPage)));
        return ['page' => $page, 'perPage' => $perPage, 'offset' => ($page - 1) * $perPage];
    }
}
