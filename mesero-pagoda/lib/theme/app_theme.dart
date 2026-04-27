// lib/theme/app_theme.dart
import 'package:flutter/material.dart';

class AppColors {
  static const Color background     = Color(0xFF1C1C1E);
  static const Color surface        = Color(0xFF2C2C2E);
  static const Color surfaceElevated = Color(0xFF3A3A3C);

  static const Color gold           = Color(0xFFD4AF37);
  static const Color goldLight      = Color(0xFFE5C158);

  static const Color textPrimary    = Color(0xFFFFFFFF);
  static const Color textSecondary  = Color(0xFF9E9EA3);
  static const Color textMuted      = Color(0xFF6E6E73);
  static const Color textDisabled   = Color(0xFF3A3A3C);

  static const Color libre          = Color(0xFF2DD4BF);
  static const Color ocupado        = Color(0xFFEF4444);
  static const Color pedidoCuenta   = Color(0xFFFBBF24);
  static const Color limpiando      = Color(0xFFD97706);

  static const Color border         = Color(0xFF2C2C2E);
}

class AppTheme {
  static ThemeData get dark => ThemeData(
    brightness: Brightness.dark,
    scaffoldBackgroundColor: AppColors.background,
    colorScheme: const ColorScheme.dark(
      primary: AppColors.gold,
      surface: AppColors.surface,
      onSurface: AppColors.textPrimary,
    ),
    useMaterial3: true,
  );
}