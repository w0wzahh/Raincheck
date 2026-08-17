package com.w0wzahh.raincheck.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.widget.RemoteViews;

import com.w0wzahh.raincheck.MainActivity;
import com.w0wzahh.raincheck.R;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class RainCheckWidgetProvider extends AppWidgetProvider {
    private static final String TAG = "RainCheckWidgetProvider";
    private static final String PREFS = "raincheck_widget";
    private static final String ACTION_REFRESH = "com.w0wzahh.raincheck.widget.REFRESH";
    private static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor();

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        Context app = context.getApplicationContext();
        Log.d(TAG, "onUpdate ids=" + (ids == null ? 0 : ids.length));
        if (ids != null) for (int id : ids) render(app, manager, id);
        refreshAll(app);
    }

    @Override
    public void onEnabled(Context context) {
        Context app = context.getApplicationContext();
        updateAll(app);
        refreshAll(app);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int appWidgetId, Bundle newOptions) {
        render(context.getApplicationContext(), manager, appWidgetId);
    }

    @Override
    public void onRestored(Context context, int[] oldIds, int[] newIds) {
        Context app = context.getApplicationContext();
        updateAll(app);
        refreshAll(app);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (intent != null) {
            String action = intent.getAction();
            if (ACTION_REFRESH.equals(action)) {
                Context app = context.getApplicationContext();
                updateAll(app);
                refreshAll(app);
            } else if (Intent.ACTION_CONFIGURATION_CHANGED.equals(action)) {
                // Automatic widget theme follows the device night-mode configuration.
                // Do not refresh weather here; only redraw the existing cached state.
                updateAll(context.getApplicationContext());
            }
        }
    }

    public static void requestRefresh(Context context) {
        Context app = context.getApplicationContext();
        Intent intent = new Intent(app, RainCheckWidgetProvider.class);
        intent.setAction(ACTION_REFRESH);
        app.sendBroadcast(intent);
    }

    public static int getWidgetCount(Context context) {
        Context app = context.getApplicationContext();
        AppWidgetManager manager = AppWidgetManager.getInstance(app);
        ComponentName provider = new ComponentName(app, RainCheckWidgetProvider.class);
        return manager.getAppWidgetIds(provider).length;
    }

    public static void updateAll(Context context) {
        Context app = context.getApplicationContext();
        AppWidgetManager manager = AppWidgetManager.getInstance(app);
        ComponentName provider = new ComponentName(app, RainCheckWidgetProvider.class);
        int[] ids = manager.getAppWidgetIds(provider);
        for (int id : ids) render(app, manager, id);
    }

    private static void refreshAll(Context context) {
        Context app = context.getApplicationContext();
        if (getWidgetCount(app) == 0) return;

        SharedPreferences prefs = app.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (!prefs.contains("lat") || !prefs.contains("lon")) return;

        final double lat = prefs.getFloat("lat", Float.NaN);
        final double lon = prefs.getFloat("lon", Float.NaN);
        final String unit = prefs.getString("unit", "metric");
        if (!Double.isFinite(lat) || !Double.isFinite(lon)) return;

        EXECUTOR.execute(() -> {
            HttpURLConnection connection = null;
            try {
                String temperatureUnit = "imperial".equals(unit) ? "fahrenheit" : "celsius";
                String endpoint = String.format(
                    Locale.US,
                    "https://api.open-meteo.com/v1/forecast" +
                    "?latitude=%.5f&longitude=%.5f" +
                    "&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,is_day,wind_speed_10m" +
                    "&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max" +
                    "&temperature_unit=%s&wind_speed_unit=kmh&forecast_days=1&timezone=auto",
                    lat, lon, temperatureUnit
                );

                connection = (HttpURLConnection) new URL(endpoint).openConnection();
                connection.setConnectTimeout(9000);
                connection.setReadTimeout(9000);
                connection.setUseCaches(false);
                connection.setRequestMethod("GET");
                connection.setRequestProperty("Accept", "application/json");

                int status = connection.getResponseCode();
                if (status < 200 || status >= 300) throw new IllegalStateException("HTTP " + status);

                StringBuilder body = new StringBuilder();
                try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = reader.readLine()) != null) body.append(line);
                }

                JSONObject root = new JSONObject(body.toString());
                JSONObject current = root.getJSONObject("current");
                JSONObject daily = root.getJSONObject("daily");
                JSONArray highs = daily.getJSONArray("temperature_2m_max");
                JSONArray lows = daily.getJSONArray("temperature_2m_min");
                JSONArray rain = daily.optJSONArray("precipitation_probability_max");
                JSONArray uv = daily.optJSONArray("uv_index_max");

                SharedPreferences.Editor editor = prefs.edit()
                    .putFloat("temperature", (float) current.getDouble("temperature_2m"))
                    .putFloat("feelsLike", (float) current.getDouble("apparent_temperature"))
                    .putFloat("high", (float) highs.getDouble(0))
                    .putFloat("low", (float) lows.getDouble(0))
                    .putInt("weatherCode", current.getInt("weather_code"))
                    .putBoolean("isDay", current.optInt("is_day", 1) == 1)
                    .putFloat("humidity", (float) current.optDouble("relative_humidity_2m", Float.NaN))
                    .putFloat("windSpeed", (float) current.optDouble("wind_speed_10m", Float.NaN))
                    .putFloat("rainChance", rain == null ? Float.NaN : (float) rain.optDouble(0, Double.NaN))
                    .putFloat("uvIndex", uv == null ? Float.NaN : (float) uv.optDouble(0, Double.NaN))
                    .putLong("updatedAt", System.currentTimeMillis());

                if (!editor.commit()) throw new IllegalStateException("Could not persist widget state");
                updateAll(app);
            } catch (Exception ex) {
                Log.e(TAG, "Open-Meteo refresh failed; retaining cached widget state", ex);
            } finally {
                if (connection != null) connection.disconnect();
            }
        });
    }

    private static void render(Context context, AppWidgetManager manager, int id) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        Bundle options = manager.getAppWidgetOptions(id);
        int minHeight = options == null ? 0 : options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0);
        int minWidth = options == null ? 0 : options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0);
        int layout = selectLayout(minWidth, minHeight);
        RemoteViews views = new RemoteViews(context.getPackageName(), layout);

        String city = prefs.getString("city", "RainCheck");
        if (city == null || city.trim().isEmpty()) city = "RainCheck";
        String unit = prefs.getString("unit", "metric");
        String theme = prefs.getString("theme", "auto");
        String degree = "imperial".equals(unit) ? "\u00B0F" : "\u00B0C";
        boolean hasWeather = prefs.contains("temperature") && prefs.getLong("updatedAt", 0L) > 0L;
        float temp = prefs.getFloat("temperature", 0f);
        float feels = prefs.getFloat("feelsLike", Float.NaN);
        float high = prefs.getFloat("high", Float.NaN);
        float low = prefs.getFloat("low", Float.NaN);
        float humidity = prefs.getFloat("humidity", Float.NaN);
        float wind = prefs.getFloat("windSpeed", Float.NaN);
        float rainChance = prefs.getFloat("rainChance", Float.NaN);
        float uvIndex = prefs.getFloat("uvIndex", Float.NaN);
        int code = prefs.getInt("weatherCode", -1);
        boolean isDay = prefs.getBoolean("isDay", true);
        long updated = prefs.getLong("updatedAt", 0L);

        views.setTextViewText(R.id.widget_city, city);
        views.setTextViewText(R.id.widget_updated, hasWeather ? relativeTime(updated) : "waiting");

        if (hasWeather) {
            views.setTextViewText(R.id.widget_temperature, String.format(Locale.getDefault(), "%.0f%s", temp, degree));
            views.setTextViewText(R.id.widget_condition, condition(code));
            views.setTextViewText(R.id.widget_feels,
                "Feels " + formatNumber(feels) + degree);
            views.setTextViewText(R.id.widget_high_low,
                "H " + formatNumber(high) + degree + "  L " + formatNumber(low) + degree);
            views.setTextViewText(R.id.widget_rain, "Rain " + formatPercent(rainChance));
            views.setTextViewText(R.id.widget_wind, "Wind " + formatNumber(wind) + " km/h");
            views.setTextViewText(R.id.widget_uv, "UV " + formatNumber(uvIndex));
            views.setTextColor(R.id.widget_condition, conditionColor(code));
            views.setImageViewResource(R.id.widget_weather_icon, weatherIcon(code));
            views.setImageViewResource(R.id.widget_condition_icon, weatherIcon(code));
        } else {
            views.setTextViewText(R.id.widget_temperature, "--" + degree);
            views.setTextViewText(R.id.widget_condition, "Open RainCheck to begin");
            views.setTextViewText(R.id.widget_feels, "Weather data will appear here");
            views.setTextViewText(R.id.widget_high_low, "");
            views.setTextViewText(R.id.widget_rain, "Rain --");
            views.setTextViewText(R.id.widget_wind, "Wind --");
            views.setTextViewText(R.id.widget_uv, "UV --");
            views.setTextColor(R.id.widget_condition, 0xFFC7D1E0);
            views.setImageViewResource(R.id.widget_weather_icon, R.drawable.widget_weather_partly);
            views.setImageViewResource(R.id.widget_condition_icon, R.drawable.widget_weather_partly);
        }

        applyTheme(views, context, theme, code);

        Intent launch = new Intent(context, MainActivity.class);
        launch.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        launch.setData(Uri.parse("raincheck://widget"));
        PendingIntent pendingIntent = PendingIntent.getActivity(
            context, id, launch,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_root, pendingIntent);
        manager.updateAppWidget(id, views);
    }

    private static int selectLayout(int minWidth, int minHeight) {
        // Android reports dp bounds, not literal launcher grid cells. Use stable size buckets
        // so the widget behaves consistently across launchers and device densities.
        if (minWidth > 0 && minHeight > 0) {
            if (minWidth < 110 && minHeight < 110) return R.layout.widget_raincheck_tiny;
            if (minWidth < 110) return R.layout.widget_raincheck_tall;
            if (minHeight < 110) return R.layout.widget_raincheck_wide;
            if (minWidth < 180 || minHeight < 140) return R.layout.widget_raincheck_compact;
        }
        return R.layout.widget_raincheck;
    }

    private static void applyTheme(RemoteViews views, Context context, String theme, int code) {
        boolean light;
        if ("light".equals(theme)) {
            light = true;
        } else if ("dark".equals(theme)) {
            light = false;
        } else {
            int nightMode = context.getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
            light = nightMode != Configuration.UI_MODE_NIGHT_YES;
        }
        if (light) {
            views.setInt(R.id.widget_root, "setBackgroundResource", R.drawable.widget_background_light);
            views.setTextColor(R.id.widget_city, 0xFF172033);
            views.setTextColor(R.id.widget_updated, 0xFF667085);
            views.setTextColor(R.id.widget_temperature, 0xFF111827);
            views.setTextColor(R.id.widget_feels, 0xFF475467);
            views.setTextColor(R.id.widget_high_low, 0xFF667085);
            views.setTextColor(R.id.widget_rain, 0xFF1877C9);
            views.setTextColor(R.id.widget_wind, 0xFF475467);
            views.setTextColor(R.id.widget_uv, 0xFF9A6700);
            views.setTextColor(R.id.widget_condition, conditionColor(code));
        } else {
            views.setInt(R.id.widget_root, "setBackgroundResource", R.drawable.widget_background_dark);
            views.setTextColor(R.id.widget_city, 0xFFF7F9FD);
            views.setTextColor(R.id.widget_updated, 0xFF91A6C2);
            views.setTextColor(R.id.widget_temperature, 0xFFF8FAFF);
            views.setTextColor(R.id.widget_feels, 0xFFB4C1D3);
            views.setTextColor(R.id.widget_high_low, 0xFF93A5BC);
            views.setTextColor(R.id.widget_rain, 0xFF82C7FF);
            views.setTextColor(R.id.widget_wind, 0xFFC4D2E4);
            views.setTextColor(R.id.widget_uv, 0xFFF1C96B);
            views.setTextColor(R.id.widget_condition, conditionColor(code));
        }
    }

    private static int backgroundFor(int code, boolean day) {
        if (!day) return R.drawable.widget_background_night;
        switch (code) {
            case 61: case 63: case 65: case 80: case 81: case 82:
            case 66: case 67: return R.drawable.widget_background_rain;
            case 71: case 73: case 75: case 77: case 85: case 86: return R.drawable.widget_background_snow;
            case 95: case 96: case 99: return R.drawable.widget_background_storm;
            case 0: case 1: return R.drawable.widget_background_clear;
            default: return R.drawable.widget_background_day;
        }
    }

    private static String formatPercent(float value) {
        return Float.isFinite(value) ? String.format(Locale.getDefault(), "%.0f%%", value) : "--";
    }

    private static String formatNumber(float value) {
        return Float.isFinite(value) ? String.format(Locale.getDefault(), "%.0f", value) : "--";
    }

    private static String relativeTime(long updated) {
        long minutes = Math.max(0, (System.currentTimeMillis() - updated) / 60000);
        if (minutes < 1) return "just now";
        if (minutes < 60) return minutes + "m ago";
        long hours = minutes / 60;
        if (hours < 24) return hours + "h ago";
        return (hours / 24) + "d ago";
    }

    private static int weatherIcon(int code) {
        switch (code) {
            case 0: return R.drawable.widget_weather_clear;
            case 1: case 2: return R.drawable.widget_weather_partly;
            case 3: return R.drawable.widget_weather_cloud;
            case 45: case 48: return R.drawable.widget_weather_fog;
            case 51: case 53: case 55: case 56: case 57:
            case 61: case 63: case 65: case 66: case 67:
            case 80: case 81: case 82: return R.drawable.widget_weather_rain;
            case 71: case 73: case 75: case 77: case 85: case 86: return R.drawable.widget_weather_snow;
            case 95: case 96: case 99: return R.drawable.widget_weather_storm;
            default: return R.drawable.widget_weather_cloud;
        }
    }

    private static int conditionColor(int code) {
        switch (code) {
            case 0: case 1: return 0xFFFFD166;
            case 2: case 3: return 0xFFB9D9FF;
            case 51: case 53: case 55: case 61: case 63: case 65:
            case 80: case 81: case 82: return 0xFF7EC8FF;
            case 71: case 73: case 75: case 77: case 85: case 86: return 0xFFC8E9FF;
            case 95: case 96: case 99: return 0xFFFFC857;
            default: return 0xFFC7D1E0;
        }
    }

    private static String condition(int code) {
        switch (code) {
            case 0: return "Clear";
            case 1: return "Mostly clear";
            case 2: return "Partly cloudy";
            case 3: return "Overcast";
            case 45: case 48: return "Foggy";
            case 51: case 53: case 55: return "Drizzle";
            case 56: case 57: return "Freezing drizzle";
            case 61: case 63: return "Rain";
            case 65: return "Heavy rain";
            case 66: case 67: return "Freezing rain";
            case 71: case 73: case 75: case 77: return "Snow";
            case 80: case 81: case 82: return "Rain showers";
            case 85: case 86: return "Snow showers";
            case 95: case 96: case 99: return "Thunderstorm";
            default: return "Weather unavailable";
        }
    }
}
