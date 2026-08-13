-keepattributes Signature, InnerClasses, EnclosingMethod
-if interface * { @retrofit2.http.* <methods>; }
-keep,allowoptimization,allowshrinking,allowobfuscation class <3>
-keep,allowoptimization,allowshrinking,allowobfuscation class kotlinx.serialization.**

