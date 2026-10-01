package it.niccomarino.tutora1a4;

import android.Manifest;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/** Collega la pagina al Picture-in-Picture di MainActivity e chiede il permesso per la notifica della guida. */
@CapacitorPlugin(
    name = "TutorPip",
    permissions = @Permission(strings = {Manifest.permission.POST_NOTIFICATIONS}, alias = "notifications")
)
public class TutorPipPlugin extends Plugin {

    private MainActivity activity() {
        return (MainActivity) getActivity();
    }

    @PluginMethod
    public void isSupported(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("supported", activity().isPipSupported());
        call.resolve(ret);
    }

    @PluginMethod
    public void setEnabled(PluginCall call) {
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        getActivity().runOnUiThread(() -> {
            activity().setPipEnabled(enabled);
            call.resolve();
        });
    }

    // Da Android 13 la notifica fissa del GPS resta nascosta se il permesso non è concesso
    @PluginMethod
    public void requestNotifications(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || getPermissionState("notifications") == PermissionState.GRANTED) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
        } else {
            requestPermissionForAlias("notifications", call, "notificationsResult");
        }
    }

    @PermissionCallback
    private void notificationsResult(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", getPermissionState("notifications") == PermissionState.GRANTED);
        call.resolve(ret);
    }

    @PluginMethod
    public void enter(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            JSObject ret = new JSObject();
            ret.put("entered", activity().enterPip());
            call.resolve(ret);
        });
    }
}
