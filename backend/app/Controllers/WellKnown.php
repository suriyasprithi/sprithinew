<?php

namespace App\Controllers;

use CodeIgniter\HTTP\ResponseInterface;

/**
 * Serves /.well-known/assetlinks.json for Android App Links verification.
 *
 * Android fetches this file over HTTPS to confirm that {package_name} is allowed
 * to handle https://<this-domain>/ref/* links automatically (no chooser dialog).
 *
 * IMPORTANT — fingerprints:
 *   - The first entry is the UPLOAD key (used for locally-signed / sideloaded APKs).
 *   - When the app is distributed via Google Play, the *installed* app is signed
 *     with Google's **Play App Signing** key, so you MUST also add that key's
 *     SHA-256 here, or App Links verification will fail for Play installs.
 *     Get it from: Play Console → <app> → Test and release → App integrity →
 *     App signing key certificate → SHA-256 certificate fingerprint.
 *     Add it to the array below (colon-separated, uppercase hex).
 */
class WellKnown extends BaseController
{
    private const PACKAGE = 'com.epey.customer';

    /** SHA-256 cert fingerprints allowed to handle the App Links. */
    private const FINGERPRINTS = [
        // Upload key (~/sprithi-release.jks, alias "sprithi").
        '22:41:4E:77:0A:E4:03:1D:99:00:D1:6F:FF:94:D9:D8:EF:08:2C:C6:6D:55:E3:66:AD:1F:1C:4D:C0:0D:D8:0E',
        // TODO: add the Play App Signing key SHA-256 from Play Console here.
    ];

    public function assetlinks(): ResponseInterface
    {
        $payload = [[
            'relation' => ['delegate_permission/common.handle_all_urls'],
            'target'   => [
                'namespace'                => 'android_app',
                'package_name'             => self::PACKAGE,
                'sha256_cert_fingerprints' => self::FINGERPRINTS,
            ],
        ]];

        return $this->response
            ->setContentType('application/json')
            ->setBody(json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
    }
}
