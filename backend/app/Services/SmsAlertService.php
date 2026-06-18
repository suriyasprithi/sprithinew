<?php

namespace App\Services;

/**
 * Sends SMS via SMS Alert (smsalert.co.in) single-message push API.
 *
 *   POST https://www.smsalert.co.in/api/push.json
 *     apikey, sender, mobileno, text  (+ template_id for DLT, optional route)
 *
 * Setup in .env:
 *   smsalert.apikey   = <API key>
 *   smsalert.sender   = <DLT-approved sender ID>
 *   smsalert.template = <DLT OTP template id>     (optional but required for delivery in India)
 *   smsalert.route    =                            (optional, account route system name)
 *   smsalert.ssl_verify = 0                         (dev-only on Windows; MUST be 1 in prod)
 *
 * Until apikey + sender are set the service is a no-op (returns false).
 */
class SmsAlertService
{
    private const ENDPOINT = 'https://www.smsalert.co.in/api/push.json';

    private string $apiKey;
    private string $sender;
    private string $templateId;
    private string $route;

    public function __construct()
    {
        $this->apiKey     = (string) (env('smsalert.apikey')   ?: '');
        $this->sender     = (string) (env('smsalert.sender')   ?: '');
        $this->templateId = (string) (env('smsalert.template') ?: '');
        $this->route      = (string) (env('smsalert.route')    ?: '');
    }

    public function isConfigured(): bool
    {
        return $this->apiKey !== '' && $this->sender !== '';
    }

    /**
     * Send `$text` to a 10-digit Indian mobile. Returns true only when SMS Alert
     * reports success. Never throws — failures are logged and return false.
     */
    public function send(string $mobile, string $text): bool
    {
        if (! $this->isConfigured()) {
            log_message('error', 'SMSAlert not configured — skipping send');
            return false;
        }

        $params = [
            'apikey'   => $this->apiKey,
            'sender'   => $this->sender,
            'mobileno' => '91' . preg_replace('/\D/', '', $mobile),
            'text'     => $text,
        ];
        if ($this->templateId !== '') $params['template_id'] = $this->templateId;
        if ($this->route !== '')      $params['route']       = $this->route;

        $res = $this->rawPost(self::ENDPOINT, http_build_query($params));
        if ($res['error'] !== '') {
            log_message('error', 'SMSAlert curl error: ' . $res['error']);
            return false;
        }

        // SMS Alert returns JSON like {"status":"success",...} or
        // {"status":"error","description":"..."}. Treat any explicit error
        // status (or non-2xx) as failure; otherwise accept. We log whenever the
        // status isn't a clean "success" so the real payload surfaces in logs.
        $json    = json_decode($res['body'], true);
        $status  = is_array($json) ? strtolower((string) ($json['status'] ?? '')) : '';
        $isError = in_array($status, ['error', 'failure', 'failed', 'invalid'], true);
        $ok      = $res['code'] >= 200 && $res['code'] < 300 && ! $isError;

        if (! $ok || $status !== 'success') {
            log_message('error', 'SMSAlert response: ' . $res['code'] . ' ' . $res['body']);
        }
        return $ok;
    }

    /**
     * Raw cURL POST with the same Windows-safe SSL handling as FirebaseService
     * (CI4's CURLRequest doesn't honour the CA bundle path consistently here).
     */
    private function rawPost(string $url, string $body): array
    {
        $sslVerify = ! in_array((string) env('smsalert.ssl_verify'), ['0', 'false', 'no'], true);
        $cacert    = env('firebase.cacert') ?: (rtrim(ROOTPATH, '/\\') . DIRECTORY_SEPARATOR . 'writable' . DIRECTORY_SEPARATOR . 'cacert.pem');

        $opts = [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $body,
            CURLOPT_HTTPHEADER     => ['Content-Type: application/x-www-form-urlencoded'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 15,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_SSL_VERIFYPEER => $sslVerify,
            CURLOPT_SSL_VERIFYHOST => $sslVerify ? 2 : 0,
        ];
        if ($sslVerify && is_string($cacert) && is_file($cacert)) {
            $opts[CURLOPT_CAINFO] = $cacert;
        }

        $ch = curl_init($url);
        curl_setopt_array($ch, $opts);
        $resp = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err  = curl_error($ch);

        return ['code' => $code, 'body' => is_string($resp) ? $resp : '', 'error' => $err];
    }
}
