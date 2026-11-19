# Capacitor & Android WebView Bridge keep rules for R8 release shrinking
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keepclassmembers class * {
    @com.getcapacitor.PluginMethod <methods>;
    @android.webkit.JavascriptInterface <methods>;
}
-keep class io.capawesome.capacitorjs.plugins.firebase.** { *; }
-dontwarn com.getcapacitor.**
