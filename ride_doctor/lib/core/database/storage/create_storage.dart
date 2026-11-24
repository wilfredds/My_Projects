// Compile-time choice of storage. `dart.library.js_interop` only exists when
// building for the web, so the browser build gets the in-memory preview and
// never sees the phone code (which would not compile there), and the phone
// build never sees the web code.
export 'create_storage_native.dart'
    if (dart.library.js_interop) 'create_storage_web.dart';
