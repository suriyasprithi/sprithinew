<?php

namespace App\Controllers\Api;

use App\Models\BlogPostModel;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Blog posts — admin authors, public reads.
 *
 *   GET    /api/v1/public/blog            list of published
 *   GET    /api/v1/public/blog/:slug      one published post by slug
 *   GET    /api/v1/admin/blog             admin list (all statuses)
 *   POST   /api/v1/admin/blog             create
 *   PATCH  /api/v1/admin/blog/:id         update
 *   DELETE /api/v1/admin/blog/:id         soft-delete
 */
class BlogController extends BaseApiController
{
    /** Public: list of published posts, newest first. */
    public function publicIndex(): ResponseInterface
    {
        $rows = (new BlogPostModel())
            ->where('status', 'published')
            ->where('published_at <=', date('Y-m-d H:i:s'))
            ->orderBy('published_at', 'DESC')
            ->orderBy('id', 'DESC')
            ->findAll(50);
        // Drop heavy content from the list payload to keep it cheap.
        $items = array_map(static function ($r) {
            unset($r['content']);
            return $r;
        }, $rows);
        return $this->ok(['items' => $items]);
    }

    /** Public: one published post by slug. */
    public function publicShow(string $slug): ResponseInterface
    {
        $row = (new BlogPostModel())
            ->where('slug', $slug)
            ->where('status', 'published')
            ->where('published_at <=', date('Y-m-d H:i:s'))
            ->first();
        if (! $row) return $this->fail('Not found', 404);
        return $this->ok(['post' => $row]);
    }

    /** Admin: list of all posts including drafts. */
    public function adminIndex(): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;
        $rows = (new BlogPostModel())
            ->orderBy('id', 'DESC')
            ->findAll();
        return $this->ok(['items' => $rows]);
    }

    public function adminShow(int $id): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;
        $row = (new BlogPostModel())->find($id);
        if (! $row) return $this->fail('Not found', 404);
        return $this->ok(['post' => $row]);
    }

    public function create(): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;
        if (! $this->validate([
            'title' => 'required|string|max_length[200]',
            'slug'  => 'permit_empty|string|max_length[160]',
        ])) {
            return $this->fail('Validation failed', 422, $this->validator->getErrors());
        }
        $d = $this->request->getJSON(true) ?? $this->request->getPost();
        $slug = $this->normalizeSlug($d['slug'] ?? '', (string) $d['title']);
        if ($this->slugExists($slug)) {
            return $this->fail('Slug already in use', 422, ['slug' => 'Pick a different slug']);
        }

        $status = in_array($d['status'] ?? 'draft', ['draft', 'published'], true) ? $d['status'] : 'draft';
        $publishedAt = $status === 'published' ? ($d['published_at'] ?? date('Y-m-d H:i:s')) : null;

        $id = (new BlogPostModel())->insert([
            'slug'         => $slug,
            'title'        => trim((string) $d['title']),
            'excerpt'      => $d['excerpt']    ?? null,
            'cover_image'  => $d['cover_image'] ?? null,
            'content'      => $d['content']    ?? null,
            'status'       => $status,
            'published_at' => $publishedAt,
        ], true);
        return $this->ok(['id' => (int) $id], 'Created');
    }

    public function update(int $id): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;
        $model = new BlogPostModel();
        $row = $model->find($id);
        if (! $row) return $this->fail('Not found', 404);

        $d = $this->request->getJSON(true) ?? $this->request->getPost();
        $payload = [];

        if (isset($d['title']) && $d['title'] !== '') $payload['title'] = trim((string) $d['title']);
        if (array_key_exists('excerpt',     $d)) $payload['excerpt']     = $d['excerpt'];
        if (array_key_exists('cover_image', $d)) $payload['cover_image'] = $d['cover_image'];
        if (array_key_exists('content',     $d)) $payload['content']     = $d['content'];

        if (isset($d['slug']) && $d['slug'] !== '') {
            $newSlug = $this->normalizeSlug((string) $d['slug'], $payload['title'] ?? $row['title']);
            if ($newSlug !== $row['slug'] && $this->slugExists($newSlug, $id)) {
                return $this->fail('Slug already in use', 422, ['slug' => 'Pick a different slug']);
            }
            $payload['slug'] = $newSlug;
        }

        if (isset($d['status']) && in_array($d['status'], ['draft', 'published'], true)) {
            $payload['status'] = $d['status'];
            if ($d['status'] === 'published' && empty($row['published_at'])) {
                $payload['published_at'] = $d['published_at'] ?? date('Y-m-d H:i:s');
            }
        }
        if (array_key_exists('published_at', $d)) {
            $payload['published_at'] = $d['published_at'] ?: null;
        }

        if (! $payload) return $this->fail('Nothing to update', 422);
        $model->update($id, $payload);
        return $this->ok(null, 'Updated');
    }

    public function delete(int $id): ResponseInterface
    {
        if ($r = $this->requireAdmin()) return $r;
        $model = new BlogPostModel();
        if (! $model->find($id)) return $this->fail('Not found', 404);
        $model->delete($id);
        return $this->ok(null, 'Deleted');
    }

    private function requireAdmin(): ?ResponseInterface
    {
        $auth = $this->authUser();
        if (! $auth)                  return $this->fail('Unauthorized', 401);
        if ($auth->role !== 'admin')  return $this->fail('Forbidden', 403);
        return null;
    }

    private function normalizeSlug(string $raw, string $titleFallback): string
    {
        $base = trim($raw) !== '' ? $raw : $titleFallback;
        $s = strtolower($base);
        $s = preg_replace('/[^a-z0-9]+/i', '-', $s);
        $s = trim((string) $s, '-');
        return substr($s, 0, 160) ?: 'post';
    }

    private function slugExists(string $slug, ?int $exceptId = null): bool
    {
        $m = (new BlogPostModel())->where('slug', $slug);
        if ($exceptId !== null) $m->where('id !=', $exceptId);
        return $m->first() !== null;
    }
}
