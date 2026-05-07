// lib/screens/login_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../theme/app_theme.dart';
import '../providers/order_provider.dart';
import 'table_map_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen>
    with TickerProviderStateMixin {
  String _inputPin = '';
  String? _activeKey;
  bool _authenticating = false;

  late AnimationController _logoCtrl;
  late AnimationController _dotsCtrl;
  late AnimationController _padCtrl;
  late Animation<double> _logoFade;
  late Animation<Offset> _logoSlide;
  late Animation<double> _dotsFade;
  late Animation<double> _padFade;
  late Animation<Offset> _padSlide;

  @override
  void initState() {
    super.initState();
    _logoCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    _dotsCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _padCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    );

    _logoFade = CurvedAnimation(parent: _logoCtrl, curve: Curves.easeOut);
    _logoSlide = Tween<Offset>(
      begin: const Offset(0, -0.3),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _logoCtrl, curve: Curves.easeOut));
    _dotsFade = CurvedAnimation(parent: _dotsCtrl, curve: Curves.easeOut);
    _padFade = CurvedAnimation(parent: _padCtrl, curve: Curves.easeOut);
    _padSlide = Tween<Offset>(
      begin: const Offset(0, 0.2),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _padCtrl, curve: Curves.easeOut));

    Future.delayed(
      const Duration(milliseconds: 100),
      () => _logoCtrl.forward(),
    );
    Future.delayed(
      const Duration(milliseconds: 400),
      () => _dotsCtrl.forward(),
    );
    Future.delayed(const Duration(milliseconds: 500), () => _padCtrl.forward());
  }

  @override
  void dispose() {
    _logoCtrl.dispose();
    _dotsCtrl.dispose();
    _padCtrl.dispose();
    super.dispose();
  }

  void _onKeyPress(String digit) {
    if (_authenticating || _inputPin.length >= 6) return;
    HapticFeedback.lightImpact();
    setState(() {
      _inputPin += digit;
      _activeKey = digit;
    });
    Future.delayed(const Duration(milliseconds: 150), () {
      if (mounted) setState(() => _activeKey = null);
    });
  }

  void _onDelete() {
    if (_authenticating || _inputPin.isEmpty) return;
    HapticFeedback.selectionClick();
    setState(() => _inputPin = _inputPin.substring(0, _inputPin.length - 1));
  }

  Future<void> _validate() async {
    if (_authenticating) return;
    if (_inputPin.length != 6) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text(
            'Ingrese un PIN de 6 dígitos',
            textAlign: TextAlign.center,
          ),
          backgroundColor: AppColors.ocupado,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          duration: const Duration(seconds: 1),
        ),
      );
      return;
    }
    setState(() => _authenticating = true);
    try {
      await context.read<OrderProvider>().loginMesero(_inputPin);
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        PageRouteBuilder(
          pageBuilder: (_, a, __) => const TableMapScreen(),
          transitionDuration: const Duration(milliseconds: 500),
          transitionsBuilder: (_, a, __, child) => FadeTransition(
            opacity: CurvedAnimation(parent: a, curve: Curves.easeOut),
            child: child,
          ),
        ),
      );
    } catch (e) {
      setState(() => _inputPin = '');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            e.toString().replaceFirst('Exception: ', ''),
            textAlign: TextAlign.center,
          ),
          backgroundColor: AppColors.ocupado,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          duration: const Duration(seconds: 1),
        ),
      );
    } finally {
      if (mounted) setState(() => _authenticating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 48),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  FadeTransition(
                    opacity: _logoFade,
                    child: SlideTransition(
                      position: _logoSlide,
                      child: _buildLogo(),
                    ),
                  ),
                  FadeTransition(opacity: _dotsFade, child: _buildDots()),
                  FadeTransition(
                    opacity: _padFade,
                    child: SlideTransition(
                      position: _padSlide,
                      child: _buildPad(),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildLogo() => Column(
    children: [
      Text(
        'PAGODA',
        style: TextStyle(
          fontSize: 32,
          fontWeight: FontWeight.w300,
          letterSpacing: 8,
          color: AppColors.gold,
          shadows: [
            Shadow(
              color: AppColors.gold.withValues(alpha: 0.3),
              blurRadius: 20,
            ),
          ],
        ),
      ),
    ],
  );

  Widget _buildDots() => Column(
    children: [
      Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: List.generate(6, (i) {
          final filled = i < _inputPin.length;
          return AnimatedContainer(
            duration: const Duration(milliseconds: 300),
            margin: const EdgeInsets.symmetric(horizontal: 10),
            width: 16,
            height: 16,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: filled ? AppColors.gold : Colors.transparent,
              border: Border.all(
                color: filled ? AppColors.gold : AppColors.surfaceElevated,
                width: 2,
              ),
              boxShadow: filled
                  ? [
                      BoxShadow(
                        color: AppColors.gold.withValues(alpha: 0.4),
                        blurRadius: 12,
                        spreadRadius: 1,
                      ),
                    ]
                  : null,
            ),
          );
        }),
      ),
      const SizedBox(height: 24),
      const Text(
        'Ingrese su PIN (6 dígitos)',
        style: TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w300,
          letterSpacing: 2,
          color: AppColors.textMuted,
        ),
      ),
    ],
  );

  Widget _buildPad() {
    final rows = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['', '0', ''],
    ];
    return Column(
      children: [
        ...rows.map(
          (row) => Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: row
                  .map(
                    (d) => Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 10),
                      child: _keyBtn(d),
                    ),
                  )
                  .toList(),
            ),
          ),
        ),
        const SizedBox(height: 16),
        GestureDetector(
          onTap: _inputPin.length == 6 && !_authenticating ? _validate : null,
          child: AnimatedOpacity(
            duration: const Duration(milliseconds: 200),
            opacity: _inputPin.length == 6 && !_authenticating ? 1 : 0.45,
            child: Container(
              width: 180,
              padding: const EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppColors.gold, AppColors.goldLight],
                ),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                _authenticating ? 'VALIDANDO...' : 'INGRESAR',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: AppColors.background,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 1.5,
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 16),
        GestureDetector(
          onTap: _onDelete,
          child: AnimatedDefaultTextStyle(
            duration: const Duration(milliseconds: 200),
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w300,
              letterSpacing: 2,
              color: _inputPin.isNotEmpty
                  ? AppColors.gold
                  : AppColors.textDisabled,
            ),
            child: const Text('BORRAR'),
          ),
        ),
      ],
    );
  }

  Widget _keyBtn(String d) {
    if (d.isEmpty) return const SizedBox(width: 80, height: 80);
    final active = _activeKey == d;
    return GestureDetector(
      onTap: () => _onKeyPress(d),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        width: 80,
        height: 80,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: active ? AppColors.gold : AppColors.surface,
          boxShadow: active
              ? [
                  BoxShadow(
                    color: AppColors.gold.withValues(alpha: 0.5),
                    blurRadius: 20,
                    spreadRadius: 2,
                  ),
                ]
              : [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.3),
                    blurRadius: 8,
                    offset: const Offset(0, 4),
                  ),
                ],
        ),
        transform: active
            ? Matrix4.diagonal3Values(0.95, 0.95, 1.0)
            : Matrix4.identity(),
        child: Center(
          child: Text(
            d,
            style: TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w300,
              color: active ? AppColors.background : AppColors.gold,
            ),
          ),
        ),
      ),
    );
  }
}
