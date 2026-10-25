# Applied to the app's release build (consumerProguardFiles), which runs R8.

# Android stores the notification-access grant by component class name
# (Settings.Secure enabled_notification_listeners), and FinlyCaptureModule
# checks it by that name. Renaming the service would silently revoke the grant
# on upgrade.
-keep class com.thecstudio.finly.capture.CaptureListenerService
