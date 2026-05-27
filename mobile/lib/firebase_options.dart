// Firebase project: ai-blog-dfd2d
// Android values come from mobile/android/app/google-services.json
// iOS/web are not configured — run `flutterfire configure` to add them.
import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      throw UnsupportedError(
        'Web is not configured. Run `flutterfire configure` to add it.',
      );
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        throw UnsupportedError(
          'iOS is not configured. Run `flutterfire configure` to add it.',
        );
      default:
        throw UnsupportedError(
          'DefaultFirebaseOptions not configured for this platform.',
        );
    }
  }

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyCqpP8lFiSe8y0UNWvE9cgH8aJQPeWzhGw',
    appId: '1:634354355277:android:425ac11460a3ca44aaa004',
    messagingSenderId: '634354355277',
    projectId: 'ai-blog-dfd2d',
    storageBucket: 'ai-blog-dfd2d.firebasestorage.app',
  );
}
