package pe.mifotito.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;

import androidx.annotation.Nullable;
import androidx.core.splashscreen.SplashScreen;

import com.google.androidbrowserhelper.trusted.LauncherActivity;

/**
 * The app is a Trusted Web Activity: mifotito.com runs in the device browser engine
 * with no browser UI, verified by /.well-known/assetlinks.json.
 *
 * This subclass adds the parts a bare TWA does not give you:
 *  - the Android 12+ system splash screen, so the first frame is branded, not white;
 *  - a native "no connection" screen instead of the browser's dinosaur page;
 *  - deep links, so a mifotito.com link tapped in WhatsApp opens here.
 */
public class MainActivity extends LauncherActivity {

    private boolean offlineShown = false;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        // Must run before super.onCreate() to take over the cold-start frame.
        SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void launchTwa() {
        if (!Connectivity.isOnline(this)) {
            showOffline();
            return;
        }
        super.launchTwa();
    }

    @Override
    protected Uri getLaunchingUrl() {
        Uri fromIntent = super.getLaunchingUrl();
        // A deep link (https://mifotito.com/pedido/abc) arrives on the intent data.
        Uri data = getIntent() != null ? getIntent().getData() : null;
        if (data != null && getString(R.string.twa_host).equalsIgnoreCase(data.getHost())) {
            return data;
        }
        return fromIntent;
    }

    private void showOffline() {
        if (offlineShown) {
            return;
        }
        offlineShown = true;
        Intent intent = new Intent(this, OfflineActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NO_ANIMATION);
        startActivity(intent);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            finish();
        } else {
            finish();
            overridePendingTransition(0, 0);
        }
    }
}
