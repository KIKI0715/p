import 'package:flutter/material.dart';

// SODA / 해피리 design tokens — extracted from the Figma design.
class HappilyColors {
  static const background = Color(0xFFFCFAF5);
  static const primary = Color(0xFF94C6FF);
  static const moodEmotion = Color(0xFFD9ECFA);
  static const moodHappy = Color(0xFFFBFFD7);
  static const moodFree = Color(0xFFF9EEF3);
  static const danger = Color(0xFFB9132B);
  static const ink = Color(0xFF222222);
  static const muted = Color(0xFF777777);
  static const card = Color(0xFFFEFEFE);

  // Mood slider colors — left (worst) → right (best)
  static const mood1 = Color(0xFFE57373); // 꽝
  static const mood2 = Color(0xFFFFB74D); // 별로
  static const mood3 = Color(0xFFBDBDBD); // 보통
  static const mood4 = Color(0xFF81C784); // 좋음
  static const mood5 = Color(0xFF64B5F6); // 아주 좋음

  static const List<Color> moodPalette = [mood1, mood2, mood3, mood4, mood5];
}

ThemeData buildHappilyTheme() {
  const scheme = ColorScheme(
    brightness: Brightness.light,
    primary: HappilyColors.primary,
    onPrimary: Colors.white,
    secondary: HappilyColors.moodHappy,
    onSecondary: HappilyColors.ink,
    error: HappilyColors.danger,
    onError: Colors.white,
    surface: HappilyColors.background,
    onSurface: HappilyColors.ink,
    surfaceContainerHighest: Color(0xFFF1EEE8),
  );

  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: HappilyColors.background,
    fontFamily: 'NotoSansKR',
    appBarTheme: const AppBarTheme(
      backgroundColor: HappilyColors.background,
      foregroundColor: HappilyColors.ink,
      elevation: 0,
      centerTitle: true,
      titleTextStyle: TextStyle(
        color: HappilyColors.ink,
        fontSize: 18,
        fontWeight: FontWeight.w600,
      ),
    ),
    textTheme: const TextTheme(
      headlineLarge: TextStyle(fontSize: 32, fontWeight: FontWeight.w300, color: HappilyColors.ink),
      headlineMedium: TextStyle(fontSize: 24, fontWeight: FontWeight.w400, color: HappilyColors.ink),
      titleLarge: TextStyle(fontSize: 20, fontWeight: FontWeight.w600, color: HappilyColors.ink),
      titleMedium: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: HappilyColors.ink),
      bodyLarge: TextStyle(fontSize: 16, color: HappilyColors.ink, height: 1.5),
      bodyMedium: TextStyle(fontSize: 14, color: HappilyColors.ink, height: 1.5),
      bodySmall: TextStyle(fontSize: 12, color: HappilyColors.muted),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: HappilyColors.primary,
        foregroundColor: Colors.white,
        minimumSize: const Size.fromHeight(52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFFE3DFD8)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFFE3DFD8)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: HappilyColors.primary, width: 1.5),
      ),
    ),
  );
}
