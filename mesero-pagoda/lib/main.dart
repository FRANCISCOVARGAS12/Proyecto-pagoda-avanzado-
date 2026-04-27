// lib/main.dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'theme/app_theme.dart';
import 'providers/order_provider.dart';
import 'screens/login_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  // Forzar orientación portrait (como POS móvil)
  SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  // StatusBar transparente sobre fondo oscuro
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
    systemNavigationBarColor: Color(0xFF1C1C1E),
    systemNavigationBarIconBrightness: Brightness.light,
  ));

  runApp(const LaPagodaApp());
}

class LaPagodaApp extends StatelessWidget {
  const LaPagodaApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => OrderProvider(),
      child: MaterialApp(
        title: 'La Pagoda POS',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.dark,
        home: const LoginScreen(),
      ),
    );
  }
}
