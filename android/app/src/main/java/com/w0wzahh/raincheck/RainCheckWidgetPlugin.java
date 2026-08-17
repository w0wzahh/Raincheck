package com.w0wzahh.raincheck;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.w0wzahh.raincheck.widget.RainCheckWidgetProvider;

@CapacitorPlugin(name = "RainCheckWidget")
public class RainCheckWidgetPlugin extends Plugin {
    private static final String TAG = "RainCheckWidgetPlugin";
    private static final String PREFS = "raincheck_widget";

    @Override
    public void load() {
        super.load();
        Log.d(TAG, "Plugin loaded");
    }

    @PluginMethod
    public void getWidgetState(PluginCall call) {
        try {
            Context context = getContext().getApplicationContext();
            SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            JSObject result = new JSObject();
            result.put("city", prefs.getString("city", "RainCheck"));
            result.put("temperature", prefs.getFloat("temperature", Float.NaN));
            String theme = prefs.getString("theme", "auto");
            int nightMode = context.getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
            String effectiveTheme = "dark".equals(theme) || ("auto".equals(theme) && nightMode == Configuration.UI_MODE_NIGHT_YES) ? "dark" : "light";
            result.put("updatedAt", prefs.getLong("updatedAt", 0L));
            result.put("theme", theme);
            result.put("effectiveTheme", effectiveTheme);
            result.put("hasCoordinates", prefs.contains("lat") && prefs.contains("lon"));
            result.put("widgetCount", RainCheckWidgetProvider.getWidgetCount(context));
            call.resolve(result);
        } catch (Exception ex) {
            Log.e(TAG, "getWidgetState() failed", ex);
            call.reject("Could not read RainCheck widget state", ex);
        }
    }

    @PluginMethod
    public void updateWidget(PluginCall call) {
        Log.d(TAG, "updateWidget() called");
        try {
            Context context = getContext().getApplicationContext();
            SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);

            String city = call.getString("city", "RainCheck");
            double lat = call.getDouble("lat", Double.NaN);
            double lon = call.getDouble("lon", Double.NaN);
            double temp = call.getDouble("temperature", Double.NaN);
            double feels = call.getDouble("feelsLike", Double.NaN);
            double high = call.getDouble("high", Double.NaN);
            double low = call.getDouble("low", Double.NaN);
            double rainChance = call.getDouble("rainChance", Double.NaN);
            double windSpeed = call.getDouble("windSpeed", Double.NaN);
            double humidity = call.getDouble("humidity", Double.NaN);
            double uvIndex = call.getDouble("uvIndex", Double.NaN);
            int code = call.getInt("weatherCode", -1);
            boolean day = call.getBoolean("isDay", true);
            String unit = call.getString("unit", "metric");
            String theme = call.getString("theme", "auto");

            if (city == null || city.trim().isEmpty()) city = "RainCheck";
            if (!Double.isFinite(lat) || !Double.isFinite(lon)) {
                call.reject("Invalid widget coordinates");
                return;
            }

            SharedPreferences.Editor editor = prefs.edit()
                .putString("city", city)
                .putFloat("lat", (float) lat)
                .putFloat("lon", (float) lon)
                .putInt("weatherCode", code)
                .putBoolean("isDay", day)
                .putString("unit", "imperial".equals(unit) ? "imperial" : "metric")
                .putString("theme", "light".equals(theme) || "dark".equals(theme) ? theme : "auto")
                .putLong("updatedAt", System.currentTimeMillis());

            if (Double.isFinite(temp)) editor.putFloat("temperature", (float) temp);
            if (Double.isFinite(feels)) editor.putFloat("feelsLike", (float) feels);
            if (Double.isFinite(high)) editor.putFloat("high", (float) high);
            if (Double.isFinite(low)) editor.putFloat("low", (float) low);
            if (Double.isFinite(rainChance)) editor.putFloat("rainChance", (float) rainChance);
            if (Double.isFinite(windSpeed)) editor.putFloat("windSpeed", (float) windSpeed);
            if (Double.isFinite(humidity)) editor.putFloat("humidity", (float) humidity);
            if (Double.isFinite(uvIndex)) editor.putFloat("uvIndex", (float) uvIndex);

            if (!editor.commit()) throw new IllegalStateException("Could not persist widget state");

            RainCheckWidgetProvider.updateAll(context);
            RainCheckWidgetProvider.requestRefresh(context);

            JSObject result = new JSObject();
            result.put("updated", true);
            result.put("city", city);
            result.put("temperature", temp);
            result.put("widgetCount", RainCheckWidgetProvider.getWidgetCount(context));
            call.resolve(result);
        } catch (Exception ex) {
            Log.e(TAG, "updateWidget() failed", ex);
            call.reject("Could not update RainCheck widget", ex);
        }
    }
}
