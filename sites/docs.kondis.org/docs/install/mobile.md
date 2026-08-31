---
sidebar_position: 5
title: Mobile apps
---

# Android setup

To build and install the Android app, you need:

- Android Studio with its bundled JDK 17 or newer. JDK 21 is recommended.
- Android SDK 37, installed through Android Studio's SDK Manager.
- An Android device running Android 8.0 or newer (API 26+), with wireless debugging enabled.
- A running Kondis server that the device can reach over the network.

You do not need to install Java separately if you use the JDK bundled with Android Studio. If you run Gradle from a terminal using another JDK, it must be JDK 17 or newer.

For now, the easiest way to install the app on Android is via wireless android debugging. You will need Android Studio on your development machine in order to connect and install the app. 

In Android Studio, navigate to the android/ folder in git and run
```bash
./gradlew :app:installDebug
```

The Kondis app will now show in your Android app drawer. Start the app, give it your server address and log in.

# iOS, Apple Watch

Currently not supported, maybe you'll help us?