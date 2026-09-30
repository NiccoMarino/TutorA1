package it.niccomarino.tutora1a4;

import android.app.PictureInPictureParams;
import android.content.res.Configuration;
import android.os.Build;
import android.os.Bundle;
import android.util.Rational;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    // Il riquadro Picture-in-Picture si apre solo durante la guida (lo decide la pagina tramite TutorPip)
    private boolean pipEnabled = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(TutorPipPlugin.class);
        super.onCreate(savedInstanceState);
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

    @Override
    public void onPictureInPictureModeChanged(boolean isInPictureInPictureMode, Configuration newConfig) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig);
        if (bridge == null || bridge.getWebView() == null) return;
        bridge.getWebView().evaluateJavascript(
            "window.dispatchEvent(new CustomEvent('tutorpip', {detail: " + isInPictureInPictureMode + "}))", null);
    }
}
