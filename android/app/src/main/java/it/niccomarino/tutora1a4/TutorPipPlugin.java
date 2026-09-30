package it.niccomarino.tutora1a4;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Collega la pagina al Picture-in-Picture di MainActivity. */
@CapacitorPlugin(name = "TutorPip")
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

    @PluginMethod
    public void enter(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            JSObject ret = new JSObject();
            ret.put("entered", activity().enterPip());
            call.resolve(ret);
        });
    }
}
