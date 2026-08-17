package com.w0wzahh.raincheck;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Capacitor collects initial plugins while BridgeActivity is being created.
        registerPlugin(RainCheckWidgetPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
