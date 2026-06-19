package com.epey.customer.installreferrer;

import com.android.installreferrer.api.InstallReferrerClient;
import com.android.installreferrer.api.InstallReferrerStateListener;
import com.android.installreferrer.api.ReferrerDetails;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Reads the Google Play Install Referrer string set when the app was installed
 * from a Play Store URL carrying `&referrer=ref%3D{code}`. Exposed to JS as
 * `InstallReferrer.getReferrer()`; resolves `{ referrer: string | null }`.
 *
 * The Install Referrer is available only for genuine Play Store installs and is
 * retained by Play for the lifetime of the install (we read it once on first
 * launch and persist the parsed code ourselves).
 */
@CapacitorPlugin(name = "InstallReferrer")
public class InstallReferrerPlugin extends Plugin {

    @PluginMethod
    public void getReferrer(final PluginCall call) {
        final InstallReferrerClient client =
                InstallReferrerClient.newBuilder(getContext()).build();

        client.startConnection(new InstallReferrerStateListener() {
            @Override
            public void onInstallReferrerSetupFinished(int responseCode) {
                JSObject ret = new JSObject();
                try {
                    if (responseCode == InstallReferrerClient.InstallReferrerResponse.OK) {
                        ReferrerDetails details = client.getInstallReferrer();
                        ret.put("referrer", details.getInstallReferrer());
                    } else {
                        ret.put("referrer", null);
                    }
                } catch (Exception e) {
                    ret.put("referrer", null);
                } finally {
                    try { client.endConnection(); } catch (Exception ignored) {}
                    call.resolve(ret);
                }
            }

            @Override
            public void onInstallReferrerServiceDisconnected() {
                // Connection dropped before setup finished — nothing to resolve here.
            }
        });
    }
}
