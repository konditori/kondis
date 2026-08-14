-keepattributes Signature, InnerClasses, EnclosingMethod
# Retrofit 3 ships the matching interface rules as consumer ProGuard rules.
# Keeping a second copy here breaks current R8 wildcard accounting.
-keep,allowoptimization,allowshrinking,allowobfuscation class kotlinx.serialization.**
