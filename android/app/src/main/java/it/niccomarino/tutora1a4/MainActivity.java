package it.niccomarino.tutora1a4;

import android.app.PictureInPictureParams;
import android.content.Context;
import android.content.res.Configuration;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.util.Rational;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    // Il riquadro Picture-in-Picture si apre solo durante la guida (lo decide la pagina tramite TutorPip)
    private boolean pipEnabled = false;
    // Attivo solo durante la guida: Indietro non deve chiudere l'app e fermare il GPS
    private OnBackPressedCallback backWhileDriving;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(TutorPipPlugin.class);
        super.onCreate(savedInstanceState);
        // Fuori dalla guida Indietro chiude prima il menù o la pagina aperta (window.tutorBack in main.js);
        // solo dalla schermata iniziale fa quello che fa di solito Android
        OnBackPressedCallback backInPage = new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView wv = bridge == null ? null : bridge.getWebView();
                if (wv == null) { systemBack(this); return; }
                wv.evaluateJavascript("!!(window.tutorBack && window.tutorBack())", r -> {
                    if (!"true".equals(r)) systemBack(this);
                });
            }
        };
        getOnBackPressedDispatcher().addCallback(this, backInPage);
        // Aggiunto dopo, ha la precedenza durante la guida
        backWhileDriving = new OnBackPressedCallback(false) {
            @Override
            public void handleOnBackPressed() {
                // Come con Home: finestrella se possibile, altrimenti l'app va in secondo piano
                if (!enterPip()) moveTaskToBack(true);
            }
        };
        getOnBackPressedDispatcher().addCallback(this, backWhileDriving);
    }

    private void systemBack(OnBackPressedCallback self) {
        self.setEnabled(false);
        getOnBackPressedDispatcher().onBackPressed();
        self.setEnabled(true);
    }

    boolean isPipSupported() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            && getPackageManager().hasSystemFeature(android.content.pm.PackageManager.FEATURE_PICTURE_IN_PICTURE);
    }

    private PictureInPictureParams buildPipParams() {
        PictureInPictureParams.Builder b = new PictureInPictureParams.Builder().setAspectRatio(new Rational(16, 10));
        // Da Android 12 la finestrella si apre da sola quando esci con il gesto Home
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            b.setAutoEnterEnabled(pipEnabled).setSeamlessResizeEnabled(false);
        }
        return b.build();
    }

    void setPipEnabled(boolean enabled) {
        pipEnabled = enabled;
        if (backWhileDriving != null) backWhileDriving.setEnabled(enabled);
        if (isPipSupported()) setPictureInPictureParams(buildPipParams());
    }

    boolean enterPip() {
        if (!isPipSupported()) return false;
        return enterPictureInPictureMode(buildPipParams());
    }

    // Android 8-11: nessun ingresso automatico, lo apriamo noi quando l'utente esce dall'app
    @Override
    protected void onUserLeaveHint() {
        super.onUserLeaveHint();
        if (pipEnabled && Build.VERSION.SDK_INT < Build.VERSION_CODES.S) enterPip();
    }

    // La X sulla finestrella non distrugge l'app: ferma solo l'activity (con lo schermo acceso).
    // Lo comunichiamo alla pagina, che termina la guida invece di lasciare il GPS acceso senza che si veda.
    @Override
    public void onStop() {
        super.onStop();
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pipEnabled && isInPictureInPictureMode() && pm != null && pm.isInteractive()) {
            sendToPage("tutorpipclosed", "null");
        }
    }

    private void sendToPage(String eventName, String detail) {
        if (bridge == null || bridge.getWebView() == null) return;
        bridge.getWebView().evaluateJavascript(
            "window.dispatchEvent(new CustomEvent('" + eventName + "', {detail: " + detail + "}))", null);
    }

    @Override
    public void onPictureInPictureModeChanged(boolean isInPictureInPictureMode, Configuration newConfig) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig);
        sendToPage("tutorpip", String.valueOf(isInPictureInPictureMode));
        // Nella finestrella la WebView cambia zoom e al ritorno lo tiene: lo riporto al 100% (più volte,
        // perché l'animazione di uscita dal riquadro dura qualche istante)
        if (!isInPictureInPictureMode) {
            if (bridge == null || bridge.getWebView() == null) return;
            WebView wv = bridge.getWebView();
            for (int delay : new int[] {200, 600, 1200}) wv.postDelayed(() -> resetZoom(wv), delay);
        }
    }

    @SuppressWarnings("deprecation")
    private void resetZoom(WebView wv) {
        float target = getResources().getDisplayMetrics().density;
        float cur = wv.getScale();
        if (cur > 0 && Math.abs(cur - target) > 0.02f) wv.zoomBy(target / cur);
    }
}
