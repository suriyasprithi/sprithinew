<?php
/**
 * Multi-vendor marketplace landing page.
 * Variables: $products, $categories, $vendors, $stats
 */
$fmtINR = static function ($n) {
    return '₹' . number_format((float) $n, 0);
};
$resolveImg = static function (?string $p): string {
    if (!$p) return '';
    if (preg_match('#^https?://#', $p)) return $p;
    return '/' . ltrim($p, '/');
};
?>
<!doctype html>
<html lang="en" data-bs-theme="light">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Epey — Local marketplace, wallet-powered</title>
  <meta name="description" content="Shop from local vendors. Earn rewards. Refer friends. A wallet-powered multi-vendor marketplace.">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH" crossorigin="anonymous">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet">
  <style>
    :root {
      --brand: #c91d1d;
      --brand-deep: #7f1010;
      --brand-soft: rgba(201,29,29,0.08);
    }
    body { font-family: 'Inter', system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background: #fafafa; }
    .text-brand { color: var(--brand) !important; }
    .bg-brand   { background: var(--brand) !important; }
    .btn-brand  { background: var(--brand); border-color: var(--brand); color: #fff; }
    .btn-brand:hover { background: var(--brand-deep); border-color: var(--brand-deep); color: #fff; }
    .btn-outline-brand { color: var(--brand); border-color: var(--brand); background: transparent; }
    .btn-outline-brand:hover { background: var(--brand); color: #fff; }
    .badge-brand { background: var(--brand-soft); color: var(--brand); border: 1px solid rgba(201,29,29,0.25); }
    .brand-gradient { background: linear-gradient(135deg, var(--brand) 0%, var(--brand-deep) 100%); color: #fff; }
    .navbar.glass { background: rgba(255,255,255,0.86); backdrop-filter: saturate(140%) blur(12px); border-bottom: 1px solid rgba(0,0,0,0.06); }
    .hero { background:
      radial-gradient(900px 400px at 100% -10%, rgba(201,29,29,0.10), transparent 60%),
      radial-gradient(700px 400px at 0% 110%, rgba(127,16,16,0.08), transparent 60%),
      #fff;
      padding: 5rem 0 4rem;
    }
    .card-product { transition: transform .2s, box-shadow .2s; border: 1px solid rgba(0,0,0,0.06); }
    .card-product:hover { transform: translateY(-3px); box-shadow: 0 12px 28px rgba(0,0,0,0.08); }
    .product-img { aspect-ratio: 1/1; background: #f3f4f6; object-fit: cover; }
    .product-img-fallback { display: flex; align-items: center; justify-content: center; color: #9ca3af; }
    .category-tile { display: flex; align-items: center; gap: .75rem; padding: 1rem; border-radius: 1rem; border: 1px solid rgba(0,0,0,0.06); background: #fff; transition: border-color .2s, transform .2s; text-decoration: none; color: inherit; }
    .category-tile:hover { border-color: var(--brand); transform: translateY(-2px); }
    .category-icon { width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; background: var(--brand-soft); color: var(--brand); border-radius: .75rem; font-size: 1.2rem; }
    .vendor-card { border: 1px solid rgba(0,0,0,0.06); border-radius: 1rem; padding: 1.25rem; background: #fff; transition: border-color .2s, transform .2s; height: 100%; }
    .vendor-card:hover { border-color: var(--brand); transform: translateY(-2px); }
    .vendor-avatar { width: 56px; height: 56px; border-radius: 1rem; background: linear-gradient(135deg, var(--brand), var(--brand-deep)); color: #fff; display: inline-flex; align-items: center; justify-content: center; font-size: 1.4rem; font-weight: 700; }
    .stat-num { font-size: 2.25rem; font-weight: 700; line-height: 1; color: var(--brand); }
    .section-eyebrow { font-size: .72rem; letter-spacing: .14em; text-transform: uppercase; color: #6b7280; }
    .footer { background: #111; color: #d1d5db; padding: 3rem 0 2rem; }
    .footer a { color: #d1d5db; text-decoration: none; }
    .footer a:hover { color: #fff; }
  </style>
</head>
<body>

<nav class="navbar navbar-expand-lg glass sticky-top">
  <div class="container">
    <a class="navbar-brand d-flex align-items-center gap-2 fw-semibold" href="/">
      <span class="bg-brand text-white d-inline-flex align-items-center justify-content-center" style="width:36px;height:36px;border-radius:.6rem;font-weight:700;">E</span>
      Epey
    </a>
    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#mainNav" aria-controls="mainNav">
      <span class="navbar-toggler-icon"></span>
    </button>
    <div class="collapse navbar-collapse" id="mainNav">
      <ul class="navbar-nav ms-auto mb-2 mb-lg-0 align-items-lg-center gap-2">
        <li class="nav-item"><a class="nav-link" href="#products">Products</a></li>
        <li class="nav-item"><a class="nav-link" href="#categories">Categories</a></li>
        <li class="nav-item"><a class="nav-link" href="#vendors">Vendors</a></li>
        <li class="nav-item"><a class="btn btn-outline-brand btn-sm" href="/customer/login/">Sign in</a></li>
        <li class="nav-item"><a class="btn btn-brand btn-sm" href="/customer/register/">Sign up</a></li>
      </ul>
    </div>
  </div>
</nav>

<!-- HERO -->
<section class="hero">
  <div class="container">
    <div class="row align-items-center g-5">
      <div class="col-lg-6">
        <span class="badge badge-brand mb-3 px-3 py-2"><i class="bi bi-stars me-1"></i> Wallet-powered marketplace</span>
        <h1 class="display-4 fw-bold mb-3">Shop. <span class="text-brand">Earn.</span> Refer.</h1>
        <p class="lead text-secondary mb-4">A simple multi-vendor marketplace that runs on wallets. Find local vendors, shop, build your network, and earn — all in one app.</p>
        <div class="d-flex flex-wrap gap-2">
          <a href="/customer/shop-public/" class="btn btn-brand btn-lg"><i class="bi bi-bag me-1"></i> Browse shop</a>
          <a href="/customer/vendors-public/" class="btn btn-outline-brand btn-lg"><i class="bi bi-shop me-1"></i> Find vendors</a>
        </div>
        <div class="d-flex flex-wrap gap-4 mt-4 small text-secondary">
          <span><i class="bi bi-stars text-brand me-1"></i> 5 wallets</span>
          <span><i class="bi bi-wallet2 text-brand me-1"></i> Instant transfers</span>
          <span><i class="bi bi-geo-alt text-brand me-1"></i> Local vendors</span>
        </div>
      </div>
      <div class="col-lg-6">
        <div class="brand-gradient rounded-4 p-5 text-center shadow-lg position-relative overflow-hidden">
          <i class="bi bi-wallet2 display-1 opacity-75"></i>
          <h3 class="mt-3 fw-bold">Your wallet, your shop.</h3>
          <p class="mb-0 opacity-75">Spend, earn rewards, refer friends.</p>
        </div>
      </div>
    </div>

    <!-- STATS -->
    <div class="row text-center mt-5 g-3">
      <div class="col-4">
        <p class="stat-num"><?= number_format((int) ($stats['products'] ?? 0)) ?>+</p>
        <p class="section-eyebrow mt-1 mb-0">Products</p>
      </div>
      <div class="col-4">
        <p class="stat-num"><?= number_format((int) ($stats['vendors'] ?? 0)) ?>+</p>
        <p class="section-eyebrow mt-1 mb-0">Local vendors</p>
      </div>
      <div class="col-4">
        <p class="stat-num"><?= number_format((int) ($stats['categories'] ?? 0)) ?>+</p>
        <p class="section-eyebrow mt-1 mb-0">Categories</p>
      </div>
    </div>
  </div>
</section>

<!-- CATEGORIES -->
<?php if (!empty($categories)): ?>
<section class="py-5" id="categories">
  <div class="container">
    <div class="d-flex justify-content-between align-items-end mb-4">
      <div>
        <p class="section-eyebrow mb-1">Browse</p>
        <h2 class="fw-bold mb-0">Shop by category</h2>
      </div>
      <a href="/customer/shop-public/" class="text-brand fw-medium">See all <i class="bi bi-arrow-right"></i></a>
    </div>
    <div class="row g-3">
      <?php foreach ($categories as $c): ?>
        <div class="col-6 col-md-4 col-lg-3">
          <a href="/customer/shop-public/?category_id=<?= (int) $c['id'] ?>" class="category-tile">
            <span class="category-icon"><i class="bi bi-grid"></i></span>
            <div class="min-w-0">
              <p class="mb-0 fw-semibold text-truncate"><?= esc($c['name']) ?></p>
              <?php if (!empty($c['commission_pct'])): ?>
                <p class="small text-secondary mb-0"><?= esc($c['commission_pct']) ?>% commission</p>
              <?php endif; ?>
            </div>
          </a>
        </div>
      <?php endforeach; ?>
    </div>
  </div>
</section>
<?php endif; ?>

<!-- FEATURED PRODUCTS -->
<section class="py-5 bg-white" id="products">
  <div class="container">
    <div class="d-flex justify-content-between align-items-end mb-4">
      <div>
        <p class="section-eyebrow mb-1">Curated</p>
        <h2 class="fw-bold mb-0">Featured products</h2>
      </div>
      <a href="/customer/shop-public/" class="text-brand fw-medium">See all <i class="bi bi-arrow-right"></i></a>
    </div>

    <?php if (empty($products)): ?>
      <div class="text-center text-secondary py-5">
        <i class="bi bi-bag display-4 text-brand mb-3 d-block"></i>
        No products yet. Check back soon.
      </div>
    <?php else: ?>
      <div class="row g-3">
        <?php foreach ($products as $p): ?>
          <div class="col-6 col-md-4 col-lg-3">
            <div class="card card-product h-100 overflow-hidden">
              <?php $img = $resolveImg($p['image'] ?? null); ?>
              <?php if ($img): ?>
                <img src="<?= esc($img) ?>" class="product-img" alt="<?= esc($p['name']) ?>">
              <?php else: ?>
                <div class="product-img product-img-fallback">
                  <span class="bg-brand text-white" style="width:48px;height:48px;border-radius:.6rem;display:inline-flex;align-items:center;justify-content:center;font-weight:700;">E</span>
                </div>
              <?php endif; ?>
              <div class="card-body p-3">
                <p class="mb-1 fw-semibold text-truncate" style="line-height:1.3"><?= esc($p['name']) ?></p>
                <?php if (!empty($p['vendor_name'])): ?>
                  <p class="small text-secondary mb-1 text-truncate"><i class="bi bi-shop me-1"></i><?= esc($p['vendor_name']) ?></p>
                <?php endif; ?>
                <p class="fw-bold text-brand mb-2 mt-1"><?= $fmtINR($p['price']) ?></p>
                <a href="/customer/product/?id=<?= (int) $p['id'] ?>" class="btn btn-brand btn-sm w-100"><i class="bi bi-bag-plus me-1"></i> View</a>
              </div>
            </div>
          </div>
        <?php endforeach; ?>
      </div>
    <?php endif; ?>
  </div>
</section>

<!-- VENDORS -->
<?php if (!empty($vendors)): ?>
<section class="py-5" id="vendors">
  <div class="container">
    <div class="d-flex justify-content-between align-items-end mb-4">
      <div>
        <p class="section-eyebrow mb-1">Network</p>
        <h2 class="fw-bold mb-0">Local vendors</h2>
      </div>
      <a href="/customer/vendors-public/" class="text-brand fw-medium">See all <i class="bi bi-arrow-right"></i></a>
    </div>
    <div class="row g-3">
      <?php foreach ($vendors as $v): ?>
        <div class="col-md-6 col-lg-4">
          <div class="vendor-card d-flex align-items-center gap-3">
            <span class="vendor-avatar"><?= esc(strtoupper(substr($v['shop_name'] ?? $v['name'] ?? '?', 0, 1))) ?></span>
            <div class="min-w-0 flex-grow-1">
              <p class="fw-semibold mb-0 text-truncate"><?= esc($v['shop_name'] ?? $v['name']) ?></p>
              <p class="small text-secondary mb-0 text-truncate">
                <?= esc($v['area'] ?? 'Local vendor') ?><?= !empty($v['pincode']) ? ' · ' . esc($v['pincode']) : '' ?>
              </p>
            </div>
          </div>
        </div>
      <?php endforeach; ?>
    </div>
  </div>
</section>
<?php endif; ?>

<!-- HOW IT WORKS -->
<section class="py-5 bg-white">
  <div class="container">
    <div class="text-center mb-5">
      <p class="section-eyebrow mb-1">Simple</p>
      <h2 class="fw-bold">How it works</h2>
    </div>
    <div class="row g-4">
      <div class="col-md-4">
        <div class="text-center">
          <div class="d-inline-flex align-items-center justify-content-center mb-3" style="width:56px;height:56px;border-radius:1rem;background:var(--brand-soft);color:var(--brand);font-size:1.5rem;">
            <i class="bi bi-person-plus"></i>
          </div>
          <h5 class="fw-semibold">1. Sign up</h5>
          <p class="text-secondary small">Create an account and top up your Epey wallet.</p>
        </div>
      </div>
      <div class="col-md-4">
        <div class="text-center">
          <div class="d-inline-flex align-items-center justify-content-center mb-3" style="width:56px;height:56px;border-radius:1rem;background:var(--brand-soft);color:var(--brand);font-size:1.5rem;">
            <i class="bi bi-bag"></i>
          </div>
          <h5 class="fw-semibold">2. Shop locally</h5>
          <p class="text-secondary small">Browse products from local vendors and pay from your wallet.</p>
        </div>
      </div>
      <div class="col-md-4">
        <div class="text-center">
          <div class="d-inline-flex align-items-center justify-content-center mb-3" style="width:56px;height:56px;border-radius:1rem;background:var(--brand-soft);color:var(--brand);font-size:1.5rem;">
            <i class="bi bi-gift"></i>
          </div>
          <h5 class="fw-semibold">3. Earn &amp; refer</h5>
          <p class="text-secondary small">Get rewards on every purchase. Refer friends for ₹15.</p>
        </div>
      </div>
    </div>

    <div class="text-center mt-5">
      <a href="/customer/register/" class="btn btn-brand btn-lg me-2"><i class="bi bi-rocket me-1"></i> Get started</a>
      <a href="/admin/" class="btn btn-outline-brand btn-lg"><i class="bi bi-shield me-1"></i> Admin panel</a>
    </div>
  </div>
</section>

<!-- FOOTER -->
<footer class="footer">
  <div class="container">
    <div class="row g-4">
      <div class="col-md-4">
        <div class="d-flex align-items-center gap-2 mb-3">
          <span class="bg-brand text-white d-inline-flex align-items-center justify-content-center" style="width:36px;height:36px;border-radius:.6rem;font-weight:700;">E</span>
          <span class="fw-bold fs-5 text-white">Epey</span>
        </div>
        <p class="small text-secondary">A wallet-powered multi-vendor marketplace. Shop local. Earn rewards.</p>
      </div>
      <div class="col-md-2 col-6">
        <p class="text-white fw-semibold mb-2">Shop</p>
        <ul class="list-unstyled small">
          <li><a href="/customer/shop-public/">All products</a></li>
          <li><a href="/customer/vendors-public/">Vendors</a></li>
        </ul>
      </div>
      <div class="col-md-2 col-6">
        <p class="text-white fw-semibold mb-2">Account</p>
        <ul class="list-unstyled small">
          <li><a href="/customer/login/">Sign in</a></li>
          <li><a href="/customer/register/">Sign up</a></li>
        </ul>
      </div>
      <div class="col-md-4">
        <p class="text-white fw-semibold mb-2">For staff</p>
        <ul class="list-unstyled small">
          <li><a href="/admin/">Admin panel</a></li>
          <li><a href="/vendor/">Vendor portal</a></li>
          <li><a href="/taluk/">Taluk portal</a></li>
          <li><a href="/district/">District portal</a></li>
          <li><a href="/state/">State portal</a></li>
        </ul>
      </div>
    </div>
    <hr class="border-secondary mt-4">
    <p class="small text-secondary mb-0">© <?= date('Y') ?> Epey · Built with CodeIgniter 4 + Next.js</p>
  </div>
</footer>

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" integrity="sha384-YvpcrYf0tY3lHB60NNkmXc5s9fDVZLESaAA55NDzOxhy9GkcIdslK1eN7N6jIeHz" crossorigin="anonymous"></script>
</body>
</html>
