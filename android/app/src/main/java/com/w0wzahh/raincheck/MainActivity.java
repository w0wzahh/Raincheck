package com.w0wzahh.raincheck;

import android.os.Build;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebViewRenderProcess;
import android.webkit.WebViewRenderProcessClient;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Capacitor collects initial plugins while BridgeActivity is being created.
        registerPlugin(RainCheckWidgetPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onStart() {
        super.onStart();
        WebView webView = getWebView();
        if (webView != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            webView.setWebViewRenderProcessClient(new WebViewRenderProcessClient() {
                @Override
                public void onRenderProcessUnresponsive(WebView view, WebViewRenderProcess renderer) {
                    if (renderer != null) renderer.terminate();
                    recreate();
                }

                @Override
                public void onRenderProcessResponsive(WebView view, WebViewRenderProcess renderer) {
                }
            });
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        WebView webView = getWebView();
        if (webView == null) return;
        webView.onResume();
        webView.resumeTimers();

        // If the render process silently died while the screen was off, JS is
        // dead but the view still shows — ping it and rebuild if unresponsive.
        final boolean[] responded = { false };
        webView.evaluateJavascript("1+1", r -> responded[0] = true);
        webView.postDelayed(() -> {
            if (!responded[0] && !isFinishing() && !isDestroyed()) recreate();
        }, 4000);
    }

    private WebView getWebView() {
        return getBridge() != null ? getBridge().getWebView() : null;
    }
}
