-keepattributes Signature, InnerClasses, EnclosingMethod
# Retrofit 3 ships the matching interface rules as consumer ProGuard rules.
# Keeping a second copy here breaks current R8 wildcard accounting.
-keep,allowoptimization,allowshrinking,allowobfuscation class kotlinx.serialization.**

# Tink (pulled in by androidx.security:security-crypto, used for SecureSessionStore) references
# these compile-only Error Prone annotations, which are never present or needed at runtime.
-dontwarn com.google.errorprone.annotations.CanIgnoreReturnValue
-dontwarn com.google.errorprone.annotations.CheckReturnValue
-dontwarn com.google.errorprone.annotations.Immutable
-dontwarn com.google.errorprone.annotations.RestrictedApi
