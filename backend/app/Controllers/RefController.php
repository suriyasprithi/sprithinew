<?php

namespace App\Controllers;

use CodeIgniter\HTTP\ResponseInterface;

/**
 * Referral deep-link landing: GET /ref/{code}
 *
 * With verified Android App Links, tapping https://<domain>/ref/{code} opens the
 * installed app directly (Android never loads this page). This page is therefore
 * the **fallback for users who do NOT have the app**:
 *   - Android  → Google Play with `&referrer=ref%3D{code}` so the Install Referrer
 *                API can recover the code on first launch (deferred deep link).
 *   - Other    → the web registration screen pre-filled with ?ref={code}.
 *
 * The referral code is the referrer's 10-digit mobile number (see AuthController).
 */
class RefController extends BaseController
{
    /** Android package id of the customer app. */
    private const PACKAGE = 'com.epey.customer';

    public function landing(string $code = ''): ResponseInterface
    {
        $code = preg_replace('/\D/', '', $code);
        $valid = (bool) preg_match('/^[0-9]{10}$/', $code);

        // Everyone (any device) goes to the web registration screen with the code
        // pre-filled. After they finish registering, the web flow forwards them to
        // the Play Store to install the app and sign in. App-installed users never
        // reach this page — their verified App Link opens the app directly.
        $base   = rtrim(base_url(), '/');
        $webUrl = $base . '/customer/register/' . ($valid ? '?ref=' . rawurlencode($code) : '');
        $target = $webUrl;

        // Cheap audit trail (no new table) — App Links opens never hit this page,
        // so a hit here means "app not installed / opened in a browser".
        log_message('info', 'referral-landing code={code} valid={valid} -> {t}', [
            'code' => $code ?: '-', 'valid' => $valid ? '1' : '0', 't' => $target,
        ]);

        $targetJs   = esc($target, 'js');
        $targetAttr = esc($target, 'attr');

        $html = <<<HTML
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Opening SPRITHI…</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#fff7f2;color:#1f2937;
       display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;text-align:center}
  .card{max-width:360px;padding:28px}
  h1{color:#d83b00;font-size:20px;margin:0 0 8px}
  p{font-size:14px;color:#6b7280;margin:0 0 18px}
  a{display:inline-block;background:#ff5a1f;color:#fff;text-decoration:none;font-weight:600;
    padding:12px 20px;border-radius:12px}
</style>
</head>
<body>
  <div class="card">
    <h1>Opening SPRITHI…</h1>
    <p>If the app does not open automatically, continue below.</p>
    <a id="go" href="{$targetAttr}">Continue</a>
  </div>
  <script>
    // If the app is installed its App Link intercepts this URL before the page
    // loads. Reaching here means it isn't — send the user to the store / web.
    setTimeout(function(){ window.location.replace("{$targetJs}"); }, 600);
    document.getElementById('go').addEventListener('click', function(e){
      e.preventDefault(); window.location.href = "{$targetJs}";
    });
  </script>
  <noscript><meta http-equiv="refresh" content="0;url={$targetAttr}"></noscript>
</body>
</html>
HTML;

        return $this->response->setBody($html)->setContentType('text/html');
    }
}
