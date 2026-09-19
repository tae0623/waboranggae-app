import java.util.Properties
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
}
val local = Properties().apply {
    rootProject.file("local.properties").takeIf { it.exists() }?.inputStream()?.use(::load)
}
val signing = Properties().apply { rootProject.file("release.properties").takeIf { it.exists() }?.inputStream()?.use(::load) }
fun setting(name: String) = local.getProperty(name, "").trim()
fun quoted(value: String) = "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "") + "\""
android {
    namespace = "kr.co.waboranggae.nativepilot"
    compileSdk = 36
    buildToolsVersion = "36.0.0"
    defaultConfig {
        applicationId = "kr.co.waboranggae.nativepilot"
        minSdk = 26
        targetSdk = 36
        versionCode = 10000
        versionName = "1.0.0"
        // S20+ evaluation build. No emulator/32-bit variants are needed for this pilot.
        ndk { abiFilters += "arm64-v8a" }
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        buildConfigField("String", "API_BASE_URL", quoted(setting("API_BASE_URL")))
        buildConfigField("String", "KAKAO_NATIVE_APP_KEY", quoted(setting("KAKAO_NATIVE_APP_KEY")))
    }
    signingConfigs {
        create("store") {
            signing.getProperty("STORE_FILE")?.let { storeFile = file(it) }
            storePassword = signing.getProperty("STORE_PASSWORD")
            keyAlias = signing.getProperty("KEY_ALIAS")
            keyPassword = signing.getProperty("KEY_PASSWORD")
            enableV1Signing = false
            enableV2Signing = true
        }
    }
    buildTypes {
        debug { buildConfigField("String", "DEV_ACCESS_KEY", quoted(setting("DEV_ACCESS_KEY"))) }
        release {
            buildConfigField("String", "DEV_ACCESS_KEY", "\"\"")
            signingConfig = signingConfigs.getByName("store")
            isDebuggable = false
        }
    }
    androidComponents {
        onVariants(selector().withBuildType("release")) { variant -> variant.applicationId.set("kr.co.ddubugi.app") }
    }
    buildFeatures { compose = true; buildConfig = true }
    sourceSets.getByName("androidTest").assets.srcDir("src/test/resources")
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
    packaging { resources.excludes += "/META-INF/{AL2.0,LGPL2.1}" }
}
if (gradle.startParameter.taskNames.any { it.contains("Release", ignoreCase = true) }) {
    check(signing.getProperty("STORE_FILE")?.let { file(it).exists() } == true) { "Release signing key is missing. Never use a debug key for the store." }
    check(setting("API_BASE_URL").startsWith("https://")) { "HTTPS API is required." }
    val verified = rootProject.file("../.runtime/release-readiness.json")
    val ready = verified.exists() && verified.readText().contains("\"readyForStore\": true") && System.currentTimeMillis()-verified.lastModified()<86_400_000
    check(ready || providers.gradleProperty("buildReleaseCandidate").orNull=="true") { "Store release blocked: public API, Kakao release registration and final checks have not been verified." }
}
dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2025.08.01")
    implementation(composeBom)
    androidTestImplementation(composeBom)
    implementation("androidx.activity:activity-compose:1.10.1")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-core")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.9.3")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.9.3")
    implementation("androidx.core:core-splashscreen:1.0.1")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.9.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("io.coil-kt:coil-compose:2.7.0")
    implementation("io.coil-kt:coil-svg:2.7.0")
    implementation("com.kakao.maps.open:android:2.15.2")
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.10.2")
    testImplementation("com.squareup.okhttp3:mockwebserver:4.12.0")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test:runner:1.6.2")
    androidTestImplementation("com.caverock:androidsvg-aar:1.4")
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
    debugImplementation("androidx.compose.ui:ui-tooling")
}
