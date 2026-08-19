import java.net.URI

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.compose.compiler)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.ksp)
    alias(libs.plugins.hilt)
    alias(libs.plugins.ktlint)
}

val releaseKeystore = providers.environmentVariable("KONDIS_SIGNING_KEYSTORE")
val releaseStorePassword = providers.environmentVariable("KONDIS_SIGNING_STORE_PASSWORD")
val releaseKeyAlias = providers.environmentVariable("KONDIS_SIGNING_KEY_ALIAS")
val releaseKeyPassword = providers.environmentVariable("KONDIS_SIGNING_KEY_PASSWORD")
val hasReleaseSigning =
    listOf(
        releaseKeystore,
        releaseStorePassword,
        releaseKeyAlias,
        releaseKeyPassword,
    ).all { it.isPresent }

android {
    namespace = "app.kondis"
    compileSdk = 37

    defaultConfig {
        applicationId = "app.kondis"
        minSdk = 26
        targetSdk = 37
        versionCode = 2
        versionName = "0.2.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables.useSupportLibrary = true
        val apiUrl = providers.gradleProperty("kondis.apiUrl").orElse("http://10.0.2.2:2293/api/v1/")
        buildConfigField("String", "DEFAULT_API_URL", "\"${apiUrl.get().trimEnd('/')}\"")

        // The OAuth/OIDC authorization-code redirect target for signing in through a perimeter
        // gateway (for example Cloudflare Access Managed OAuth). This is a single, Kondis-owned
        // HTTPS App Link shared by every self-hosted deployment: identity providers are configured
        // with a fixed, pre-registered redirect URI, so it cannot vary per server. Forks that ship
        // under a different applicationId must own this domain (serving `assetlinks.json` for their
        // signing certificate) and override this property; see android/README.md.
        val oauthRedirectUri =
            providers.gradleProperty("kondis.oauthRedirectUri").orElse("https://auth.kondis.app/android/oauth2redirect")
        buildConfigField("String", "OAUTH_REDIRECT_URI", "\"${oauthRedirectUri.get()}\"")
        val oauthRedirectParsed = URI(oauthRedirectUri.get())
        manifestPlaceholders["oauthRedirectHost"] = oauthRedirectParsed.host
        manifestPlaceholders["oauthRedirectPathPrefix"] = oauthRedirectParsed.path
    }

    signingConfigs {
        if (hasReleaseSigning) {
            create("release") {
                storeFile = file(releaseKeystore.get())
                storePassword = releaseStorePassword.get()
                keyAlias = releaseKeyAlias.get()
                keyPassword = releaseKeyPassword.get()
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            signingConfig = signingConfigs.findByName("release")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        isCoreLibraryDesugaringEnabled = true
    }

    buildFeatures {
        buildConfig = true
        compose = true
    }

    packaging.resources.excludes += "/META-INF/{AL2.0,LGPL2.1}"

    testOptions.unitTests.isIncludeAndroidResources = true

    lint {
        abortOnError = true
        checkReleaseBuilds = true
        warningsAsErrors = true
        disable += setOf("ObsoleteSdkInt")
    }
}

kotlin {
    compilerOptions {
        allWarningsAsErrors.set(true)
        progressiveMode.set(true)
    }
}

ktlint {
    android.set(true)
    ignoreFailures.set(false)
    outputToConsole.set(true)
    version.set("1.8.0")
}

ksp {
    arg("room.schemaLocation", "$projectDir/schemas")
    arg("room.generateKotlin", "true")
}

hilt {
    enableAggregatingTask = true
}

dependencies {
    coreLibraryDesugaring(libs.desugar.jdk.libs)

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.navigation3.runtime)
    implementation(libs.androidx.navigation3.ui)
    implementation(libs.androidx.hilt.navigation.compose)
    implementation(libs.androidx.room.runtime)
    implementation(libs.androidx.room.ktx)
    implementation(libs.androidx.work.runtime)
    implementation(libs.androidx.hilt.work)
    implementation(libs.androidx.datastore.preferences)
    implementation(libs.androidx.splashscreen)
    implementation(libs.androidx.security.crypto)
    implementation(libs.appauth)
    // Explicit, newer than AppAuth's own transitive 1.3.0: brings androidx.browser.auth.AuthTabIntent,
    // the purpose-built (ephemeral, non-Custom-Tab) browser surface for OAuth sign-in.
    implementation(libs.androidx.browser)
    implementation(libs.hilt.android)
    implementation(libs.retrofit.core)
    implementation(libs.retrofit.serialization)
    implementation(libs.okhttp.logging)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.kotlinx.coroutines.android)
    ksp(libs.hilt.compiler)
    ksp(libs.androidx.hilt.compiler)
    ksp(libs.androidx.room.compiler)

    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material.icons)
    debugImplementation(libs.androidx.compose.ui.tooling)
    debugImplementation(libs.androidx.compose.ui.test.manifest)

    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.turbine)
    testImplementation(libs.androidx.test.core)
    testImplementation(libs.okhttp.mockwebserver)

    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
    androidTestImplementation(libs.androidx.test.runner)
    androidTestImplementation(libs.androidx.test.rules)
    androidTestImplementation(libs.androidx.test.junit)
    androidTestImplementation(libs.androidx.test.uiautomator)
    androidTestImplementation(libs.androidx.test.espresso)
    androidTestImplementation(libs.okhttp.mockwebserver)
}
