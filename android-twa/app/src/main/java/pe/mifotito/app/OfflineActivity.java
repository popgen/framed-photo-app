package pe.mifotito.app;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;

/**
 * Shown when the phone has no connection at launch. Retrying goes back through
 * MainActivity, which re-checks and opens the shop when the network is back.
 */
public class OfflineActivity extends Activity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_offline);
        Button retry = findViewById(R.id.retry);
        retry.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                retry();
            }
        });
    }

    @Override
    protected void onResume() {
        super.onResume();
        // Coming back from Settings with Wi-Fi on should not need a second tap.
        if (Connectivity.isOnline(this)) {
            retry();
        }
    }

    private void retry() {
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NO_ANIMATION);
        startActivity(intent);
        finish();
    }
}
