// lib/screens/order_summary_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import '../theme/app_theme.dart';
import '../models/models.dart';
import '../providers/order_provider.dart';
import 'login_screen.dart';

// ─────────────────────────────────────────────────────────────
// PANTALLA: Resumen de orden
// ─────────────────────────────────────────────────────────────
class OrderSummaryScreen extends StatefulWidget {
  const OrderSummaryScreen({super.key});
  @override
  State<OrderSummaryScreen> createState() => _OrderSummaryScreenState();
}

class _OrderSummaryScreenState extends State<OrderSummaryScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _fadeCtrl;
  late Animation<double> _fadeAnim;
  bool _redirectingToLogin = false;

  @override
  void initState() {
    super.initState();
    _fadeCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 450),
    )..forward();
    _fadeAnim = CurvedAnimation(parent: _fadeCtrl, curve: Curves.easeOut);
  }

  @override
  void dispose() {
    _fadeCtrl.dispose();
    super.dispose();
  }

  void _sendToKitchen(BuildContext context, OrderProvider order) {
    showDialog(
      context: context,
      barrierColor: Colors.black.withOpacity(0.8),
      builder: (_) => _ConfirmDialog(
        icon: Icons.restaurant_outlined,
        title: 'Enviar a Cocina',
        body: '${order.pendingToKitchen.length} platillo(s) serán enviados.',
        confirmLabel: 'ENVIAR',
        onConfirm: () {
          order.confirmKitchenRound();
          Navigator.pop(context);
          Navigator.pop(context);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: const Row(
                children: [
                  Icon(
                    Icons.restaurant_outlined,
                    color: AppColors.libre,
                    size: 16,
                  ),
                  SizedBox(width: 8),
                  Text(
                    '¡Ronda enviada a cocina!',
                    style: TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
              backgroundColor: AppColors.surfaceElevated,
              behavior: SnackBarBehavior.floating,
              margin: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              duration: const Duration(seconds: 2),
            ),
          );
        },
      ),
    );
  }

  void _showPayment(BuildContext context, OrderProvider order) {
    if (order.pendingToKitchen.isNotEmpty) order.confirmKitchenRound();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ChangeNotifierProvider.value(
        value: order,
        child: const _PaymentSheet(),
      ),
    ).then((_) {
      if (!mounted) return;
      if (context.read<OrderProvider>().currentTable == null) {
        Navigator.of(context).popUntil((route) => route.isFirst);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final order = context.watch<OrderProvider>();
    _handleForcedLogout(order);
    if (!order.isAuthenticated && _redirectingToLogin) {
      return const Scaffold(backgroundColor: AppColors.background);
    }
    return Scaffold(
      backgroundColor: AppColors.background,
      body: FadeTransition(
        opacity: _fadeAnim,
        child: SafeArea(
          child: Column(
            children: [
              _buildHeader(context, order),
              Expanded(child: _buildList(order)),
              _buildFooter(context, order),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context, OrderProvider order) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: AppColors.border)),
      ),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => Navigator.pop(context),
            child: const Icon(
              Icons.chevron_left,
              color: AppColors.gold,
              size: 28,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  order.currentTable?.name ?? 'Resumen',
                  style: TextStyle(
                    fontSize: 16,
                    color: AppColors.gold,
                    fontWeight: FontWeight.w300,
                    letterSpacing: 1,
                    shadows: [
                      Shadow(
                        color: AppColors.gold.withOpacity(0.3),
                        blurRadius: 8,
                      ),
                    ],
                  ),
                ),
                Text(
                  '${order.allItems.length} platillo${order.allItems.length != 1 ? 's' : ''}',
                  style: const TextStyle(
                    fontSize: 11,
                    color: AppColors.textMuted,
                    fontWeight: FontWeight.w300,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildList(OrderProvider order) {
    final kitchen = order.alreadyInKitchen;
    final pending = order.pendingToKitchen;
    if (kitchen.isEmpty && pending.isEmpty) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.receipt_long_outlined,
              size: 56,
              color: AppColors.textDisabled,
            ),
            SizedBox(height: 16),
            Text(
              'Sin platillos aún',
              style: TextStyle(
                color: AppColors.textMuted,
                fontSize: 16,
                fontWeight: FontWeight.w300,
              ),
            ),
          ],
        ),
      );
    }
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        if (kitchen.isNotEmpty) ...[
          const _SectionLabel(
            label: 'EN COCINA',
            icon: Icons.restaurant_outlined,
            color: AppColors.libre,
          ),
          const SizedBox(height: 8),
          ...kitchen.asMap().entries.map(
            (e) => _itemRow(e.value, e.key, isNew: false),
          ),
        ],
        if (pending.isNotEmpty) ...[
          if (kitchen.isNotEmpty) const SizedBox(height: 16),
          const _SectionLabel(
            label: 'ESTA RONDA',
            icon: Icons.pending_outlined,
            color: AppColors.goldLight,
          ),
          const SizedBox(height: 8),
          ...pending.asMap().entries.map(
            (e) => _itemRow(e.value, e.key, isNew: true),
          ),
        ],
      ],
    );
  }

  Widget _itemRow(OrderItem item, int index, {required bool isNew}) {
    final order = context.read<OrderProvider>();
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: Duration(milliseconds: 280 + index * 55),
      curve: Curves.easeOut,
      builder: (_, v, child) => Opacity(
        opacity: v,
        child: Transform.translate(
          offset: Offset(0, 8 * (1 - v)),
          child: child,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 10),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 4,
              height: 40,
              margin: const EdgeInsets.only(right: 12),
              decoration: BoxDecoration(
                color: isNew
                    ? AppColors.gold.withOpacity(0.7)
                    : AppColors.libre.withOpacity(0.6),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.name,
                    style: const TextStyle(
                      fontSize: 14,
                      color: AppColors.textPrimary,
                      fontWeight: FontWeight.w300,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Comensal ${item.diner}${item.notes != null ? ' · ${item.notes}' : ''}',
                    style: const TextStyle(
                      fontSize: 11,
                      color: AppColors.textMuted,
                      fontWeight: FontWeight.w300,
                    ),
                  ),
                ],
              ),
            ),
            Text(
              '\$${item.price.toStringAsFixed(2)}',
              style: const TextStyle(
                fontSize: 14,
                color: AppColors.gold,
                fontWeight: FontWeight.w400,
              ),
            ),
            const SizedBox(width: 10),
            if (isNew)
              GestureDetector(
                onTap: () => order.removePendingItem(item.id),
                child: const Icon(
                  Icons.close,
                  size: 18,
                  color: AppColors.textMuted,
                ),
              )
            else
              const Icon(
                Icons.check_circle_outline,
                size: 18,
                color: AppColors.libre,
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildFooter(BuildContext context, OrderProvider order) {
    final hasPending = order.pendingToKitchen.isNotEmpty;
    final hasAny = order.allItems.isNotEmpty;
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: AppColors.border)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (order.alreadyInKitchen.isNotEmpty)
            _TotalRow(
              label: 'En cocina',
              value: order.alreadyInKitchen.fold(0.0, (s, i) => s + i.price),
              color: AppColors.textSecondary,
            ),
          if (hasPending)
            _TotalRow(
              label: 'Esta ronda',
              value: order.pendingToKitchen.fold(0.0, (s, i) => s + i.price),
              color: AppColors.goldLight,
            ),
          const Divider(color: AppColors.border, height: 20),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'TOTAL',
                style: TextStyle(
                  fontSize: 16,
                  color: AppColors.gold,
                  fontWeight: FontWeight.w400,
                  letterSpacing: 2,
                  shadows: [
                    Shadow(
                      color: AppColors.gold.withOpacity(0.3),
                      blurRadius: 8,
                    ),
                  ],
                ),
              ),
              Text(
                '\$${order.grandTotal.toStringAsFixed(2)}',
                style: TextStyle(
                  fontSize: 22,
                  color: AppColors.gold,
                  fontWeight: FontWeight.w300,
                  shadows: [
                    Shadow(
                      color: AppColors.gold.withOpacity(0.3),
                      blurRadius: 8,
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (hasPending) ...[
            _ActionBtn(
              label: 'ENVIAR A COCINA',
              icon: Icons.restaurant_outlined,
              gradient: const LinearGradient(
                colors: [Color(0xFF2DD4BF), Color(0xFF14B8A6)],
              ),
              onTap: () => _sendToKitchen(context, order),
            ),
            const SizedBox(height: 10),
            // Aviso: no se puede cobrar hasta enviar a cocina
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: AppColors.ocupado.withOpacity(0.07),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.ocupado.withOpacity(0.25)),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.info_outline,
                    size: 15,
                    color: AppColors.ocupado.withOpacity(0.8),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Envía los platillos a cocina antes de cobrar.',
                      style: TextStyle(
                        fontSize: 11,
                        color: AppColors.ocupado.withOpacity(0.9),
                        fontWeight: FontWeight.w300,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),
          ],
          // Solo habilitar cobrar si NO hay pendientes
          _ActionBtn(
            label: 'COBRAR MESA',
            icon: Icons.payments_outlined,
            gradient: (hasAny && !hasPending)
                ? const LinearGradient(
                    colors: [AppColors.gold, AppColors.goldLight],
                  )
                : null,
            disabled: !hasAny || hasPending,
            onTap: (hasAny && !hasPending)
                ? () => _showPayment(context, order)
                : null,
          ),
        ],
      ),
    );
  }

  void _handleForcedLogout(OrderProvider order) {
    if (_redirectingToLogin || order.isAuthenticated) return;
    if (order.logoutReason != 'jornada_cerrada') return;
    _redirectingToLogin = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text(
            'La jornada se cerró. Inicia sesión nuevamente.',
            textAlign: TextAlign.center,
          ),
          backgroundColor: AppColors.surfaceElevated,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          duration: const Duration(seconds: 2),
        ),
      );
      order.clearLogoutReason();
      Navigator.of(context).pushAndRemoveUntil(
        PageRouteBuilder(
          pageBuilder: (_, a, __) => const LoginScreen(),
          transitionDuration: const Duration(milliseconds: 350),
          transitionsBuilder: (_, a, __, child) => FadeTransition(
            opacity: CurvedAnimation(parent: a, curve: Curves.easeOut),
            child: child,
          ),
        ),
        (route) => false,
      );
    });
  }
}

// ─────────────────────────────────────────────────────────────
// SHEET: selección de modo + método de pago
// ─────────────────────────────────────────────────────────────
class _PaymentSheet extends StatefulWidget {
  const _PaymentSheet();
  @override
  State<_PaymentSheet> createState() => _PaymentSheetState();
}

class _PaymentSheetState extends State<_PaymentSheet> {
  // 'total' | 'equitativo' | 'individual'
  String _mode = 'total';

  // ── Modo total: puede ser 'efectivo' | 'tarjeta' | 'mixto' ─────
  String? _method;
  String _tipScope = 'global'; // global | per_diner
  String _tipGlobalMethod = 'efectivo'; // efectivo | tarjeta
  String _tipGlobalCardMode = 'amount'; // amount | percent

  // Campo de efectivo para pago mixto (solo modo total) ──────────
  final TextEditingController _cashCtrl = TextEditingController();
  // Propina global
  final TextEditingController _tipGlobalCtrl = TextEditingController();

  // ── Modo individual por comensal ──────────────────────────────
  final Map<int, String> _dinerMethods = {};
  final Map<int, TextEditingController> _dinerCashCtrls = {};
  final Map<int, TextEditingController> _dinerTipCtrls = {};
  final Map<int, String> _dinerTipMethods = {};
  final Map<int, String> _dinerTipCardModes = {};
  final Set<int> _paidDiners = {};

  // ── Modo equitativo por comensal ──────────────────────────────
  final Map<int, String> _eqDinerMethods = {};
  final Map<int, TextEditingController> _eqDinerCashCtrls = {};
  final Map<int, TextEditingController> _eqDinerTipCtrls = {};
  final Map<int, String> _eqDinerTipMethods = {};
  final Map<int, String> _eqDinerTipCardModes = {};
  final Set<int> _paidEqDiners = {};
  bool _isClosingSale = false;

  @override
  void dispose() {
    _cashCtrl.dispose();
    _tipGlobalCtrl.dispose();
    for (final c in _dinerCashCtrls.values) {
      c.dispose();
    }
    for (final c in _dinerTipCtrls.values) {
      c.dispose();
    }
    for (final c in _eqDinerCashCtrls.values) {
      c.dispose();
    }
    for (final c in _eqDinerTipCtrls.values) {
      c.dispose();
    }
    super.dispose();
  }

  // ── Helpers ───────────────────────────────────────────────────

  /// Parsea el campo de texto; devuelve 0 si está vacío o inválido
  double _parseAmount(TextEditingController ctrl) =>
      double.tryParse(ctrl.text.replaceAll(',', '.')) ?? 0.0;

  double _parseTipText(
    String text,
    double baseAmount,
    String method, {
    bool cardAsPercent = false,
  }) {
    final normalized = text.trim().replaceAll(',', '.');
    if (normalized.isEmpty) return 0;
    final amount = double.tryParse(normalized.replaceAll('%', '')) ?? 0;
    if (amount <= 0) return 0;
    if (method == 'tarjeta' && cardAsPercent) {
      return baseAmount * (amount / 100);
    }
    return amount < 0 ? 0 : amount;
  }

  double _tipFromCtrl(
    TextEditingController ctrl,
    double baseAmount,
    String method, {
    bool cardAsPercent = false,
  }) => _parseTipText(
    ctrl.text,
    baseAmount,
    method,
    cardAsPercent: cardAsPercent,
  );

  double _globalTip(OrderProvider order) => _tipFromCtrl(
    _tipGlobalCtrl,
    order.grandTotal,
    _tipGlobalMethod,
    cardAsPercent:
        _tipGlobalMethod == 'tarjeta' && _tipGlobalCardMode == 'percent',
  );

  List<int> _dinersWithItems(OrderProvider order) {
    return List.generate(
      order.diners,
      (i) => i + 1,
    ).where((d) => order.allItems.any((item) => item.diner == d)).toList();
  }

  double _individualTipForDiner(
    OrderProvider order,
    int dinerNum,
    double dinerTotal,
  ) {
    if (_tipScope == 'global') {
      final withItems = _dinersWithItems(order);
      if (withItems.isEmpty) return 0;
      return _globalTip(order) / withItems.length;
    }
    _dinerTipCtrls.putIfAbsent(dinerNum, () => TextEditingController());
    final method = _dinerTipMethods[dinerNum] ?? 'efectivo';
    final cardMode = _dinerTipCardModes[dinerNum] ?? 'amount';
    return _tipFromCtrl(
      _dinerTipCtrls[dinerNum]!,
      dinerTotal,
      method,
      cardAsPercent: method == 'tarjeta' && cardMode == 'percent',
    );
  }

  double _equitativoTipForDiner(
    OrderProvider order,
    int dinerNum,
    double basePerDiner,
  ) {
    if (_tipScope == 'global') {
      if (order.diners <= 0) return 0;
      return _globalTip(order) / order.diners;
    }
    _eqDinerTipCtrls.putIfAbsent(dinerNum, () => TextEditingController());
    final method = _eqDinerTipMethods[dinerNum] ?? 'efectivo';
    final cardMode = _eqDinerTipCardModes[dinerNum] ?? 'amount';
    return _tipFromCtrl(
      _eqDinerTipCtrls[dinerNum]!,
      basePerDiner,
      method,
      cardAsPercent: method == 'tarjeta' && cardMode == 'percent',
    );
  }

  double _totalWithTipsForMode(OrderProvider order) {
    if (_mode == 'total' || _tipScope == 'global') {
      return order.grandTotal + _globalTip(order);
    }
    if (_mode == 'individual') {
      final withItems = _dinersWithItems(order);
      final tips = withItems.fold<double>(0, (sum, d) {
        final dinerTotal = order.allItems
            .where((i) => i.diner == d)
            .fold(0.0, (s, i) => s + i.price);
        return sum + _individualTipForDiner(order, d, dinerTotal);
      });
      return order.grandTotal + tips;
    }
    if (_mode == 'equitativo') {
      final basePerDiner = order.diners > 0
          ? order.grandTotal / order.diners
          : 0.0;
      final tips = List.generate(order.diners, (i) => i + 1).fold<double>(
        0,
        (sum, d) => sum + _equitativoTipForDiner(order, d, basePerDiner),
      );
      return order.grandTotal + tips;
    }
    return order.grandTotal;
  }

  /// Dado un total y el efectivo ingresado, devuelve el resto en tarjeta.
  /// Devuelve null si el efectivo supera el total.
  double? _cardAmount(double total, double cash) {
    if (cash < 0 || cash > total + 0.001) return null;
    return (total - cash).clamp(0, total);
  }

  bool _mixtoValid(double total, TextEditingController ctrl) {
    final cash = _parseAmount(ctrl);
    return cash > 0 && cash < total - 0.001;
  }

  PaymentMethod _paymentFromKey(String key) =>
      key == 'tarjeta' ? PaymentMethod.tarjeta : PaymentMethod.efectivo;

  List<PaymentRecord> _buildTotalPayments(
    double total,
    double tip,
    double? cash,
    double? card,
  ) {
    final tipMethod = tip > 0 ? _paymentFromKey(_tipGlobalMethod) : null;
    if (_method == 'mixto') {
      final cashAmount = cash ?? 0;
      final cardAmount = card ?? 0;
      return [
        PaymentRecord(
          diner: null,
          method: PaymentMethod.efectivo,
          amount: cashAmount,
          tipAmount: tipMethod == PaymentMethod.efectivo ? tip : 0,
          tipMethod: tipMethod == PaymentMethod.efectivo ? tipMethod : null,
        ),
        PaymentRecord(
          diner: null,
          method: PaymentMethod.tarjeta,
          amount: cardAmount,
          tipAmount: tipMethod == PaymentMethod.tarjeta ? tip : 0,
          tipMethod: tipMethod == PaymentMethod.tarjeta ? tipMethod : null,
        ),
      ].where((p) => p.amount > 0).toList();
    }

    final method = _method == 'tarjeta'
        ? PaymentMethod.tarjeta
        : PaymentMethod.efectivo;
    return [
      PaymentRecord(
        diner: null,
        method: method,
        amount: total,
        tipAmount: tip,
        tipMethod: tipMethod,
      ),
    ];
  }

  List<PaymentRecord> _buildIndividualPayments(OrderProvider order) {
    final withItems = _dinersWithItems(order);
    final records = <PaymentRecord>[];
    for (final diner in withItems) {
      final dinerItems = order.allItems.where((i) => i.diner == diner).toList();
      final dinerTotal = dinerItems.fold(0.0, (s, i) => s + i.price);
      final dinerTip = _individualTipForDiner(order, diner, dinerTotal);
      final method = _dinerMethods[diner] ?? 'efectivo';
      final tipMethod = _tipScope == 'global'
          ? _paymentFromKey(_tipGlobalMethod)
          : _paymentFromKey(_dinerTipMethods[diner] ?? 'efectivo');

      if (method == 'mixto') {
        final cash = _parseAmount(_dinerCashCtrls[diner]!);
        final card = _cardAmount(dinerTotal + dinerTip, cash) ?? 0;
        records.add(
          PaymentRecord(
            diner: diner,
            method: PaymentMethod.efectivo,
            amount: cash,
            tipAmount: tipMethod == PaymentMethod.efectivo ? dinerTip : 0,
            tipMethod: tipMethod == PaymentMethod.efectivo ? tipMethod : null,
          ),
        );
        records.add(
          PaymentRecord(
            diner: diner,
            method: PaymentMethod.tarjeta,
            amount: card,
            tipAmount: tipMethod == PaymentMethod.tarjeta ? dinerTip : 0,
            tipMethod: tipMethod == PaymentMethod.tarjeta ? tipMethod : null,
          ),
        );
      } else {
        records.add(
          PaymentRecord(
            diner: diner,
            method: _paymentFromKey(method),
            amount: dinerTotal + dinerTip,
            tipAmount: dinerTip,
            tipMethod: tipMethod,
          ),
        );
      }
    }
    return records.where((p) => p.amount > 0).toList();
  }

  List<PaymentRecord> _buildEquitativoPayments(OrderProvider order) {
    final basePerDiner = order.diners > 0
        ? order.grandTotal / order.diners
        : 0.0;
    final records = <PaymentRecord>[];
    for (final diner in List.generate(order.diners, (i) => i + 1)) {
      final dinerTip = _equitativoTipForDiner(order, diner, basePerDiner);
      final dinerTotal = basePerDiner + dinerTip;
      final method = _eqDinerMethods[diner] ?? 'efectivo';
      final tipMethod = _tipScope == 'global'
          ? _paymentFromKey(_tipGlobalMethod)
          : _paymentFromKey(_eqDinerTipMethods[diner] ?? 'efectivo');

      if (method == 'mixto') {
        final cash = _parseAmount(_eqDinerCashCtrls[diner]!);
        final card = _cardAmount(dinerTotal, cash) ?? 0;
        records.add(
          PaymentRecord(
            diner: diner,
            method: PaymentMethod.efectivo,
            amount: cash,
            tipAmount: tipMethod == PaymentMethod.efectivo ? dinerTip : 0,
            tipMethod: tipMethod == PaymentMethod.efectivo ? tipMethod : null,
          ),
        );
        records.add(
          PaymentRecord(
            diner: diner,
            method: PaymentMethod.tarjeta,
            amount: card,
            tipAmount: tipMethod == PaymentMethod.tarjeta ? dinerTip : 0,
            tipMethod: tipMethod == PaymentMethod.tarjeta ? tipMethod : null,
          ),
        );
      } else {
        records.add(
          PaymentRecord(
            diner: diner,
            method: _paymentFromKey(method),
            amount: dinerTotal,
            tipAmount: dinerTip,
            tipMethod: tipMethod,
          ),
        );
      }
    }
    return records.where((p) => p.amount > 0).toList();
  }

  void _showError(BuildContext context, Object error) {
    final message = error.toString().replaceFirst('Exception: ', '');
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message, textAlign: TextAlign.center),
        backgroundColor: AppColors.ocupado,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  void _confirmTipAmount({
    required BuildContext context,
    required double tipAmount,
    required Future<void> Function() onConfirmed,
  }) {
    if (tipAmount <= 0) {
      onConfirmed();
      return;
    }
    showDialog(
      context: context,
      barrierColor: Colors.black.withOpacity(0.8),
      builder: (_) => _ConfirmDialog(
        icon: Icons.attach_money,
        title: 'Confirmar Propina',
        body: '¿Confirmas una propina de \$${tipAmount.toStringAsFixed(2)}?',
        confirmLabel: 'CONFIRMAR PROPINA',
        onConfirm: () async {
          Navigator.pop(context);
          await onConfirmed();
        },
      ),
    );
  }

  // ── Generación de PDF ─────────────────────────────────────────
  Future<void> _generateTicket(
    OrderProvider order, {
    int? soloComensalNum,
    int? equitativoComensalNum,
    double? montoEquitativo,
    int? totalComensalesEq,
    double tipAmount = 0,
    String? equitativoMethod,
    // pago mixto
    double? cashPart,
    double? cardPart,
  }) async {
    final pdf = pw.Document();
    final now = DateTime.now();
    final date =
        '${now.day.toString().padLeft(2, '0')}/${now.month.toString().padLeft(2, '0')}/${now.year}  '
        '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}';

    // Construir línea(s) de pago
    List<pw.Widget> _payRows({
      required double? cash,
      required double? card,
      required String singleMethod,
    }) {
      if (cash != null && card != null) {
        return [
          pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
            children: [
              pw.Text(
                'Efectivo:',
                style: pw.TextStyle(fontSize: 8, color: PdfColors.grey600),
              ),
              pw.Text(
                '\$${cash.toStringAsFixed(2)}',
                style: pw.TextStyle(fontSize: 8, color: PdfColors.grey600),
              ),
            ],
          ),
          pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
            children: [
              pw.Text(
                'Tarjeta:',
                style: pw.TextStyle(fontSize: 8, color: PdfColors.grey600),
              ),
              pw.Text(
                '\$${card.toStringAsFixed(2)}',
                style: pw.TextStyle(fontSize: 8, color: PdfColors.grey600),
              ),
            ],
          ),
        ];
      }
      return [
        pw.Row(
          mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
          children: [
            pw.Text(
              'Forma de pago:',
              style: pw.TextStyle(fontSize: 8, color: PdfColors.grey600),
            ),
            pw.Text(
              singleMethod,
              style: pw.TextStyle(fontSize: 8, color: PdfColors.grey600),
            ),
          ],
        ),
      ];
    }

    // ── Ticket equitativo ────────────────────────────────────────
    if (montoEquitativo != null && totalComensalesEq != null) {
      final method = equitativoMethod == 'tarjeta'
          ? 'Tarjeta'
          : equitativoMethod == 'mixto'
          ? 'Mixto'
          : 'Efectivo';
      final eqCash = method == 'Mixto' ? cashPart : null;
      final eqCard = method == 'Mixto' ? cardPart : null;

      pdf.addPage(
        pw.Page(
          pageFormat: PdfPageFormat.roll80,
          margin: const pw.EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          build: (_) => pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.center,
            children: [
              pw.Text(
                'PAGODA',
                style: pw.TextStyle(
                  fontSize: 18,
                  fontWeight: pw.FontWeight.bold,
                ),
              ),
              pw.Text('Restaurante Asiático', style: pw.TextStyle(fontSize: 9)),
              pw.SizedBox(height: 6),
              pw.Divider(),
              pw.Row(
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                children: [
                  pw.Text(
                    order.currentTable?.name ?? 'Mesa',
                    style: pw.TextStyle(fontSize: 10),
                  ),
                  pw.Text(date, style: pw.TextStyle(fontSize: 8)),
                ],
              ),
              if (equitativoComensalNum != null) ...[
                pw.SizedBox(height: 2),
                pw.Text(
                  'Comensal $equitativoComensalNum',
                  style: pw.TextStyle(fontSize: 9, color: PdfColors.grey600),
                ),
              ],
              pw.Divider(),
              pw.SizedBox(height: 4),
              pw.Text(
                'Cobro dividido equitativamente',
                style: pw.TextStyle(fontSize: 9, color: PdfColors.grey600),
              ),
              pw.Text(
                'entre $totalComensalesEq comensales',
                style: pw.TextStyle(fontSize: 9, color: PdfColors.grey600),
              ),
              pw.SizedBox(height: 8),
              pw.Row(
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                children: [
                  pw.Text('Total general:', style: pw.TextStyle(fontSize: 9)),
                  pw.Text(
                    '\$${order.grandTotal.toStringAsFixed(2)}',
                    style: pw.TextStyle(fontSize: 9),
                  ),
                ],
              ),
              if (tipAmount > 0) ...[
                pw.SizedBox(height: 4),
                pw.Row(
                  mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                  children: [
                    pw.Text('Propina:', style: pw.TextStyle(fontSize: 9)),
                    pw.Text(
                      '\$${tipAmount.toStringAsFixed(2)}',
                      style: pw.TextStyle(fontSize: 9),
                    ),
                  ],
                ),
              ],
              pw.SizedBox(height: 6),
              pw.Divider(thickness: 1.5),
              pw.Row(
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                children: [
                  pw.Text(
                    'SU PARTE',
                    style: pw.TextStyle(
                      fontSize: 13,
                      fontWeight: pw.FontWeight.bold,
                    ),
                  ),
                  pw.Text(
                    '\$${montoEquitativo.toStringAsFixed(2)}',
                    style: pw.TextStyle(
                      fontSize: 13,
                      fontWeight: pw.FontWeight.bold,
                    ),
                  ),
                ],
              ),
              pw.SizedBox(height: 3),
              ..._payRows(cash: eqCash, card: eqCard, singleMethod: method),
              pw.SizedBox(height: 10),
              pw.Text(
                '¡Gracias por su visita!',
                style: pw.TextStyle(
                  fontSize: 11,
                  fontWeight: pw.FontWeight.bold,
                ),
              ),
              pw.Text(
                'Esperamos verle pronto',
                style: pw.TextStyle(fontSize: 8),
              ),
            ],
          ),
        ),
      );

      // ── Ticket individual o total ────────────────────────────────
    } else {
      final items = soloComensalNum != null
          ? order.allItems.where((i) => i.diner == soloComensalNum).toList()
          : order.allItems;
      final itemsTotal = items.fold(0.0, (s, i) => s + i.price);
      final effectiveTip = tipAmount;
      final total = itemsTotal + effectiveTip;

      String singleMethod;
      double? pdfCash = cashPart;
      double? pdfCard = cardPart;

      if (soloComensalNum != null) {
        final m = _dinerMethods[soloComensalNum] ?? 'efectivo';
        singleMethod = m == 'tarjeta'
            ? 'Tarjeta'
            : m == 'mixto'
            ? 'Mixto'
            : 'Efectivo';
        if (m == 'mixto') {
          pdfCash = _parseAmount(_dinerCashCtrls[soloComensalNum]!);
          pdfCard = total - pdfCash;
        } else {
          pdfCash = null;
          pdfCard = null;
        }
      } else {
        singleMethod = _method == 'tarjeta'
            ? 'Tarjeta'
            : _method == 'mixto'
            ? 'Mixto'
            : 'Efectivo';
      }

      pdf.addPage(
        pw.Page(
          pageFormat: PdfPageFormat.roll80,
          margin: const pw.EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          build: (_) => pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.center,
            children: [
              pw.Text(
                'PAGODA',
                style: pw.TextStyle(
                  fontSize: 18,
                  fontWeight: pw.FontWeight.bold,
                ),
              ),
              pw.Text('Restaurante Asiático', style: pw.TextStyle(fontSize: 9)),
              pw.SizedBox(height: 6),
              pw.Divider(),
              pw.Row(
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                children: [
                  pw.Text(
                    soloComensalNum != null
                        ? '${order.currentTable?.name ?? "Mesa"} · Comensal $soloComensalNum'
                        : order.currentTable?.name ?? 'Mesa',
                    style: pw.TextStyle(fontSize: 10),
                  ),
                  pw.Text(date, style: pw.TextStyle(fontSize: 8)),
                ],
              ),
              pw.Divider(),
              pw.SizedBox(height: 4),
              ...items.map(
                (item) => pw.Padding(
                  padding: const pw.EdgeInsets.symmetric(vertical: 2),
                  child: pw.Row(
                    mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                    children: [
                      pw.Expanded(
                        child: pw.Column(
                          crossAxisAlignment: pw.CrossAxisAlignment.start,
                          children: [
                            pw.Text(
                              item.name,
                              style: pw.TextStyle(fontSize: 10),
                            ),
                            if (soloComensalNum == null)
                              pw.Text(
                                '  Comensal ${item.diner}',
                                style: pw.TextStyle(
                                  fontSize: 8,
                                  color: PdfColors.grey600,
                                ),
                              ),
                            if (item.notes != null && item.notes!.isNotEmpty)
                              pw.Text(
                                '  ${item.notes}',
                                style: pw.TextStyle(
                                  fontSize: 8,
                                  color: PdfColors.grey600,
                                  fontStyle: pw.FontStyle.italic,
                                ),
                              ),
                          ],
                        ),
                      ),
                      pw.Text(
                        '\$${item.price.toStringAsFixed(2)}',
                        style: pw.TextStyle(fontSize: 10),
                      ),
                    ],
                  ),
                ),
              ),
              pw.SizedBox(height: 6),
              pw.Divider(thickness: 1.5),
              if (effectiveTip > 0)
                pw.Row(
                  mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                  children: [
                    pw.Text('SUBTOTAL', style: pw.TextStyle(fontSize: 9)),
                    pw.Text(
                      '\$${itemsTotal.toStringAsFixed(2)}',
                      style: pw.TextStyle(fontSize: 9),
                    ),
                  ],
                ),
              if (effectiveTip > 0)
                pw.Row(
                  mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                  children: [
                    pw.Text('PROPINA', style: pw.TextStyle(fontSize: 9)),
                    pw.Text(
                      '\$${effectiveTip.toStringAsFixed(2)}',
                      style: pw.TextStyle(fontSize: 9),
                    ),
                  ],
                ),
              pw.Row(
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                children: [
                  pw.Text(
                    'TOTAL',
                    style: pw.TextStyle(
                      fontSize: 13,
                      fontWeight: pw.FontWeight.bold,
                    ),
                  ),
                  pw.Text(
                    '\$${total.toStringAsFixed(2)}',
                    style: pw.TextStyle(
                      fontSize: 13,
                      fontWeight: pw.FontWeight.bold,
                    ),
                  ),
                ],
              ),
              pw.SizedBox(height: 3),
              ..._payRows(
                cash: pdfCash,
                card: pdfCard,
                singleMethod: singleMethod,
              ),
              pw.SizedBox(height: 10),
              pw.Text(
                '¡Gracias por su visita!',
                style: pw.TextStyle(
                  fontSize: 11,
                  fontWeight: pw.FontWeight.bold,
                ),
              ),
              pw.Text(
                'Esperamos verle pronto',
                style: pw.TextStyle(fontSize: 8),
              ),
            ],
          ),
        ),
      );
    }

    await Printing.layoutPdf(onLayout: (_) async => pdf.save());
  }

  // ── Confirmaciones ────────────────────────────────────────────

  void _confirmTotal(BuildContext context, OrderProvider order) {
    final tip = _globalTip(order);
    final total = order.grandTotal + tip;
    final isMixto = _method == 'mixto';
    final cash = isMixto ? _parseAmount(_cashCtrl) : null;
    final card = isMixto ? _cardAmount(total, cash!) : null;

    final bodyText = isMixto
        ? 'Total: \$${total.toStringAsFixed(2)}\n'
              '${tip > 0 ? 'Propina: \$${tip.toStringAsFixed(2)}\n' : ''}'
              'Efectivo: \$${cash!.toStringAsFixed(2)}\nTarjeta: \$${card!.toStringAsFixed(2)}'
        : 'Total: \$${total.toStringAsFixed(2)}\n'
              '${tip > 0 ? 'Propina: \$${tip.toStringAsFixed(2)}\n' : ''}'
              'Método: ${_method == 'tarjeta' ? 'Tarjeta' : 'Efectivo'}';

    _confirmTipAmount(
      context: context,
      tipAmount: tip,
      onConfirmed: () async {
        showDialog(
          context: context,
          barrierColor: Colors.black.withOpacity(0.8),
          builder: (_) => _ConfirmDialog(
            icon: Icons.check_circle_outline,
            title: 'Confirmar Cobro',
            body: bodyText,
            confirmLabel: 'COBRAR E IMPRIMIR',
            onConfirm: () async {
              Navigator.pop(context);
              if (_isClosingSale) return;
              setState(() => _isClosingSale = true);
              try {
                if (order.currentTable != null) {
                  order.updateTip(order.currentTable!, tip);
                }
                await order.registrarVenta(
                  mode: ChargeMode.total,
                  payments: _buildTotalPayments(total, tip, cash, card),
                  totalCuenta: total,
                );
                await _generateTicket(
                  order,
                  tipAmount: tip,
                  cashPart: cash,
                  cardPart: card,
                );
                order.clearOrder();
                if (context.mounted) Navigator.pop(context);
              } catch (e) {
                if (context.mounted) _showError(context, e);
              } finally {
                if (mounted) setState(() => _isClosingSale = false);
              }
            },
          ),
        );
      },
    );
  }

  void _confirmEquitativoDiner(
    BuildContext context,
    OrderProvider order,
    int dinerNum,
  ) {
    final basePerDiner = order.diners > 0
        ? order.grandTotal / order.diners
        : 0.0;
    final dinerTip = _equitativoTipForDiner(order, dinerNum, basePerDiner);
    final monto = basePerDiner + dinerTip;
    final method = _eqDinerMethods[dinerNum] ?? 'efectivo';
    final cashCtrl = _eqDinerCashCtrls[dinerNum]!;
    final cash = method == 'mixto' ? _parseAmount(cashCtrl) : null;
    final card = method == 'mixto' ? _cardAmount(monto, cash!) : null;
    final methodLabel = method == 'tarjeta'
        ? 'Tarjeta'
        : method == 'mixto'
        ? 'Mixto'
        : 'Efectivo';

    final bodyText = method == 'mixto'
        ? 'Comensal $dinerNum\nTotal: \$${monto.toStringAsFixed(2)}\n'
              '${dinerTip > 0 ? 'Propina: \$${dinerTip.toStringAsFixed(2)}\n' : ''}'
              'Efectivo: \$${cash!.toStringAsFixed(2)}\nTarjeta: \$${card!.toStringAsFixed(2)}'
        : 'Comensal $dinerNum\nTotal: \$${monto.toStringAsFixed(2)}\n'
              '${dinerTip > 0 ? 'Propina: \$${dinerTip.toStringAsFixed(2)}\n' : ''}'
              'Método: $methodLabel';

    _confirmTipAmount(
      context: context,
      tipAmount: dinerTip,
      onConfirmed: () async {
        showDialog(
          context: context,
          barrierColor: Colors.black.withOpacity(0.8),
          builder: (_) => _ConfirmDialog(
            icon: Icons.call_split_outlined,
            title: 'División Equitativa',
            body: bodyText,
            confirmLabel: 'PAGADO E IMPRIMIR',
            onConfirm: () async {
              Navigator.pop(context);
              if (order.currentTable != null) {
                final totalTip =
                    _totalWithTipsForMode(order) - order.grandTotal;
                order.updateTip(order.currentTable!, totalTip);
              }
              await _generateTicket(
                order,
                equitativoComensalNum: dinerNum,
                montoEquitativo: monto,
                totalComensalesEq: order.diners,
                tipAmount: dinerTip,
                equitativoMethod: method,
                cashPart: cash,
                cardPart: card,
              );
              if (!mounted) return;
              setState(() {
                _paidEqDiners.add(dinerNum);
              });
            },
          ),
        );
      },
    );
  }

  void _confirmDiner(BuildContext context, OrderProvider order, int dinerNum) {
    final dinerItems = order.allItems
        .where((i) => i.diner == dinerNum)
        .toList();
    final dinerTotal = dinerItems.fold(0.0, (s, i) => s + i.price);
    final dinerTip = _individualTipForDiner(order, dinerNum, dinerTotal);
    final totalToPay = dinerTotal + dinerTip;
    final method = _dinerMethods[dinerNum] ?? 'efectivo';
    final cashCtrl = _dinerCashCtrls[dinerNum]!;
    final cash = method == 'mixto' ? _parseAmount(cashCtrl) : null;
    final card = method == 'mixto' ? _cardAmount(totalToPay, cash!) : null;
    final bodyText = method == 'mixto'
        ? 'Total: \$${totalToPay.toStringAsFixed(2)}\n'
              '${dinerTip > 0 ? 'Propina: \$${dinerTip.toStringAsFixed(2)}\n' : ''}'
              'Efectivo: \$${cash!.toStringAsFixed(2)}\nTarjeta: \$${card!.toStringAsFixed(2)}'
        : 'Total: \$${totalToPay.toStringAsFixed(2)}\n'
              '${dinerTip > 0 ? 'Propina: \$${dinerTip.toStringAsFixed(2)}\n' : ''}'
              'Método: ${method == 'tarjeta' ? 'Tarjeta' : 'Efectivo'}';

    _confirmTipAmount(
      context: context,
      tipAmount: dinerTip,
      onConfirmed: () async {
        showDialog(
          context: context,
          barrierColor: Colors.black.withOpacity(0.8),
          builder: (_) => _ConfirmDialog(
            icon: Icons.person_outline,
            title: 'Comensal $dinerNum',
            body: bodyText,
            confirmLabel: 'PAGADO E IMPRIMIR',
            onConfirm: () async {
              Navigator.pop(context);
              if (order.currentTable != null) {
                final totalTip =
                    _totalWithTipsForMode(order) - order.grandTotal;
                order.updateTip(order.currentTable!, totalTip);
              }
              await _generateTicket(
                order,
                soloComensalNum: dinerNum,
                tipAmount: dinerTip,
                cashPart: cash,
                cardPart: card,
              );
              if (!mounted) return;
              setState(() {
                _paidDiners.add(dinerNum);
              });
            },
          ),
        );
      },
    );
  }

  // ── Build del sheet ───────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    final order = context.watch<OrderProvider>();
    final onlyTotalMode = order.diners <= 1;
    if (onlyTotalMode && _mode != 'total') {
      _mode = 'total';
      _dinerMethods.clear();
      _paidDiners.clear();
      _eqDinerMethods.clear();
      _paidEqDiners.clear();
      _dinerTipMethods.clear();
      _eqDinerTipMethods.clear();
      _dinerTipCardModes.clear();
      _eqDinerTipCardModes.clear();
    }
    if (onlyTotalMode) _tipScope = 'global';
    final tip = (_mode == 'total' || _tipScope == 'global')
        ? _globalTip(order)
        : 0.0;
    final totalWithTip = _totalWithTipsForMode(order);
    final eqPerDiner = totalWithTip / (order.diners > 0 ? order.diners : 1);
    final eqBasePerDiner =
        order.grandTotal / (order.diners > 0 ? order.diners : 1);
    return Container(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom + 32,
        top: 28,
        left: 24,
        right: 24,
      ),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Handle
            Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(bottom: 24),
              decoration: BoxDecoration(
                color: AppColors.surfaceElevated,
                borderRadius: BorderRadius.circular(2),
              ),
            ),

            Text(
              'Cobrar Mesa',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w300,
                color: AppColors.gold,
                shadows: [
                  Shadow(
                    color: AppColors.gold.withOpacity(0.3),
                    blurRadius: 10,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Total: \$${totalWithTip.toStringAsFixed(2)}',
              style: const TextStyle(
                fontSize: 14,
                color: AppColors.textSecondary,
                fontWeight: FontWeight.w300,
              ),
            ),
            if (tip > 0)
              Text(
                'Incluye propina: \$${tip.toStringAsFixed(2)}',
                style: const TextStyle(
                  fontSize: 11,
                  color: AppColors.textMuted,
                  fontWeight: FontWeight.w300,
                ),
              ),
            const SizedBox(height: 18),

            const Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'PROPINA (OPCIONAL)',
                style: TextStyle(
                  fontSize: 10,
                  color: AppColors.textMuted,
                  letterSpacing: 2,
                  fontWeight: FontWeight.w400,
                ),
              ),
            ),
            const SizedBox(height: 10),
            if (!onlyTotalMode && _mode != 'total') ...[
              Row(
                children: [
                  Expanded(
                    child: _ModeChip(
                      label: 'Global',
                      icon: Icons.public_outlined,
                      selected: _tipScope == 'global',
                      onTap: () => setState(() {
                        _tipScope = 'global';
                        _dinerTipCtrls.clear();
                        _eqDinerTipCtrls.clear();
                      }),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _ModeChip(
                      label: 'Por comensal',
                      icon: Icons.person_outline,
                      selected: _tipScope == 'per_diner',
                      onTap: () => setState(() => _tipScope = 'per_diner'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
            ],
            if (_mode == 'total' || _tipScope == 'global')
              Column(
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: _SmallMethodBtn(
                          icon: Icons.payments_outlined,
                          label: 'Propina efectivo',
                          selected: _tipGlobalMethod == 'efectivo',
                          onTap: () =>
                              setState(() => _tipGlobalMethod = 'efectivo'),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _SmallMethodBtn(
                          icon: Icons.credit_card_outlined,
                          label: 'Propina tarjeta',
                          selected: _tipGlobalMethod == 'tarjeta',
                          onTap: () => setState(() {
                            _tipGlobalMethod = 'tarjeta';
                            _tipGlobalCardMode = 'amount';
                          }),
                        ),
                      ),
                    ],
                  ),
                  if (_tipGlobalMethod == 'tarjeta') ...[
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: _SmallMethodBtn(
                            icon: Icons.attach_money,
                            label: 'Cantidad',
                            selected: _tipGlobalCardMode == 'amount',
                            onTap: () =>
                                setState(() => _tipGlobalCardMode = 'amount'),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: _SmallMethodBtn(
                            icon: Icons.percent,
                            label: 'Porcentaje',
                            selected: _tipGlobalCardMode == 'percent',
                            onTap: () =>
                                setState(() => _tipGlobalCardMode = 'percent'),
                          ),
                        ),
                      ],
                    ),
                  ],
                  const SizedBox(height: 10),
                  TextField(
                    controller: _tipGlobalCtrl,
                    onChanged: (_) => setState(() {}),
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                    ),
                    inputFormatters: [
                      FilteringTextInputFormatter.allow(
                        RegExp(
                          _tipGlobalMethod == 'tarjeta' &&
                                  _tipGlobalCardMode == 'percent'
                              ? r'[\d.,]'
                              : r'[\d.,]',
                        ),
                      ),
                    ],
                    style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 14,
                      fontWeight: FontWeight.w300,
                    ),
                    decoration: InputDecoration(
                      hintText: _tipGlobalMethod == 'tarjeta'
                          ? (_tipGlobalCardMode == 'percent'
                                ? 'Porcentaje'
                                : 'Cantidad')
                          : 'Cantidad',
                      hintStyle: const TextStyle(
                        color: AppColors.textMuted,
                        fontSize: 13,
                      ),
                      prefixText:
                          _tipGlobalMethod == 'tarjeta' &&
                              _tipGlobalCardMode == 'percent'
                          ? null
                          : '\$  ',
                      prefixStyle:
                          _tipGlobalMethod == 'tarjeta' &&
                              _tipGlobalCardMode == 'percent'
                          ? null
                          : const TextStyle(
                              color: AppColors.gold,
                              fontSize: 15,
                            ),
                      suffixText:
                          _tipGlobalMethod == 'tarjeta' &&
                              _tipGlobalCardMode == 'percent'
                          ? '%'
                          : null,
                      suffixStyle: const TextStyle(
                        color: AppColors.gold,
                        fontSize: 13,
                      ),
                      filled: true,
                      fillColor: AppColors.background,
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 12,
                      ),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: BorderSide.none,
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(
                          color: AppColors.gold,
                          width: 1.2,
                        ),
                      ),
                    ),
                  ),
                ],
              )
            else
              const Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'La propina se captura en cada comensal.',
                  style: TextStyle(
                    fontSize: 11,
                    color: AppColors.textMuted,
                    fontWeight: FontWeight.w300,
                  ),
                ),
              ),
            const SizedBox(height: 24),

            // ── Selector de modo ────────────────────────────────────
            const Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'MODO DE COBRO',
                style: TextStyle(
                  fontSize: 10,
                  color: AppColors.textMuted,
                  letterSpacing: 2,
                  fontWeight: FontWeight.w400,
                ),
              ),
            ),
            const SizedBox(height: 12),
            if (onlyTotalMode)
              _ModeChip(
                label: 'Cuenta total',
                icon: Icons.receipt_long_outlined,
                selected: true,
                onTap: () => setState(() {
                  _mode = 'total';
                  _dinerMethods.clear();
                  _paidDiners.clear();
                  _eqDinerMethods.clear();
                  _paidEqDiners.clear();
                  _dinerTipMethods.clear();
                  _eqDinerTipMethods.clear();
                  _dinerTipCardModes.clear();
                  _eqDinerTipCardModes.clear();
                }),
              )
            else ...[
              Row(
                children: [
                  Expanded(
                    child: _ModeChip(
                      label: 'Cuenta total',
                      icon: Icons.receipt_long_outlined,
                      selected: _mode == 'total',
                      onTap: () => setState(() {
                        _mode = 'total';
                        _dinerMethods.clear();
                        _paidDiners.clear();
                        _eqDinerMethods.clear();
                        _paidEqDiners.clear();
                        _dinerTipMethods.clear();
                        _eqDinerTipMethods.clear();
                        _dinerTipCardModes.clear();
                        _eqDinerTipCardModes.clear();
                      }),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _ModeChip(
                      label: 'Por comensal',
                      icon: Icons.people_outline,
                      selected: _mode == 'individual',
                      onTap: () => setState(() {
                        _mode = 'individual';
                        _method = null;
                        _eqDinerMethods.clear();
                        _paidEqDiners.clear();
                        _eqDinerTipMethods.clear();
                        _eqDinerTipCardModes.clear();
                      }),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              _ModeChip(
                label:
                    'Dividir equitativamente  ·  '
                    '\$${(totalWithTip / (order.diners > 0 ? order.diners : 1)).toStringAsFixed(2)} c/u',
                icon: Icons.call_split_outlined,
                selected: _mode == 'equitativo',
                onTap: () => setState(() {
                  _mode = 'equitativo';
                  _method = null;
                  _eqDinerMethods.clear();
                  _paidEqDiners.clear();
                  _dinerMethods.clear();
                  _paidDiners.clear();
                  _dinerTipMethods.clear();
                  _dinerTipCardModes.clear();
                }),
              ),
            ],
            const SizedBox(height: 22),

            // ════════════════════════════════════════════════════
            // MODO TOTAL
            // ════════════════════════════════════════════════════
            if (_mode == 'total') ...[
              const Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'MÉTODO DE PAGO',
                  style: TextStyle(
                    fontSize: 10,
                    color: AppColors.textMuted,
                    letterSpacing: 2,
                    fontWeight: FontWeight.w400,
                  ),
                ),
              ),
              const SizedBox(height: 12),
              // Efectivo
              _PaymentOption(
                icon: Icons.payments_outlined,
                label: 'Efectivo',
                subtitle: 'Pago en moneda o billete',
                selected: _method == 'efectivo',
                onTap: () => setState(() {
                  _method = 'efectivo';
                  _cashCtrl.clear();
                }),
              ),
              const SizedBox(height: 10),
              // Tarjeta
              _PaymentOption(
                icon: Icons.credit_card_outlined,
                label: 'Tarjeta',
                subtitle: 'Crédito o débito',
                selected: _method == 'tarjeta',
                onTap: () => setState(() {
                  _method = 'tarjeta';
                  _cashCtrl.clear();
                }),
              ),
              const SizedBox(height: 10),
              // Mixto
              _PaymentOption(
                icon: Icons.compare_arrows_outlined,
                label: 'Pago mixto',
                subtitle: 'Parte en efectivo, parte en tarjeta',
                selected: _method == 'mixto',
                onTap: () => setState(() {
                  _method = 'mixto';
                  _cashCtrl.clear();
                }),
              ),

              // ── Panel mixto ─────────────────────────────────────
              if (_method == 'mixto') ...[
                const SizedBox(height: 16),
                _MixtoPanel(
                  total: totalWithTip,
                  cashCtrl: _cashCtrl,
                  onChanged: () => setState(() {}),
                ),
              ],

              const SizedBox(height: 20),
              GestureDetector(
                onTap: !_isClosingSale && _canConfirmTotal(totalWithTip)
                    ? () => _confirmTotal(context, order)
                    : null,
                child: _buildPayBtn(
                  enabled: !_isClosingSale && _canConfirmTotal(totalWithTip),
                ),
              ),
            ],

            // ════════════════════════════════════════════════════
            // MODO EQUITATIVO
            // ════════════════════════════════════════════════════
            if (_mode == 'equitativo') ...[
              // Resumen visual
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.background,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.gold.withOpacity(0.3)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Total de la mesa',
                          style: TextStyle(
                            fontSize: 12,
                            color: AppColors.textSecondary,
                            fontWeight: FontWeight.w300,
                          ),
                        ),
                        Text(
                          '\$${totalWithTip.toStringAsFixed(2)}',
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppColors.textSecondary,
                            fontWeight: FontWeight.w300,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '÷ ${order.diners} comensales',
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.textSecondary,
                        fontWeight: FontWeight.w300,
                      ),
                    ),
                    const Divider(color: AppColors.border, height: 16),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Cada quien paga',
                          style: TextStyle(
                            fontSize: 14,
                            color: AppColors.gold,
                            fontWeight: FontWeight.w400,
                          ),
                        ),
                        Text(
                          '\$${(_tipScope == 'global' ? eqPerDiner : eqBasePerDiner).toStringAsFixed(2)}',
                          style: TextStyle(
                            fontSize: 18,
                            color: AppColors.gold,
                            fontWeight: FontWeight.w300,
                            shadows: [
                              Shadow(
                                color: AppColors.gold.withOpacity(0.3),
                                blurRadius: 6,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              const Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'PAGO POR COMENSAL (EQUITATIVO)',
                  style: TextStyle(
                    fontSize: 10,
                    color: AppColors.textMuted,
                    letterSpacing: 2,
                    fontWeight: FontWeight.w400,
                  ),
                ),
              ),
              const SizedBox(height: 12),
              ConstrainedBox(
                constraints: const BoxConstraints(maxHeight: 480),
                child: ListView.separated(
                  shrinkWrap: true,
                  physics: const ClampingScrollPhysics(),
                  itemCount: order.diners,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (_, i) => _buildEquitativoDinerCard(
                    context,
                    order,
                    i + 1,
                    eqPerDiner,
                  ),
                ),
              ),

              Builder(
                builder: (ctx) {
                  final allPaid =
                      order.diners > 0 &&
                      List.generate(
                        order.diners,
                        (i) => i + 1,
                      ).every((d) => _paidEqDiners.contains(d));
                  if (!allPaid) return const SizedBox.shrink();
                  return Padding(
                    padding: const EdgeInsets.only(top: 16),
                    child: GestureDetector(
                      onTap: _isClosingSale
                          ? null
                          : () async {
                              setState(() => _isClosingSale = true);
                              try {
                                final total = _totalWithTipsForMode(order);
                                await order.registrarVenta(
                                  mode: ChargeMode.equitativo,
                                  payments: _buildEquitativoPayments(order),
                                  totalCuenta: total,
                                );
                                order.clearOrder();
                                if (ctx.mounted) Navigator.pop(ctx);
                              } catch (e) {
                                if (ctx.mounted) _showError(ctx, e);
                              } finally {
                                if (mounted)
                                  setState(() => _isClosingSale = false);
                              }
                            },
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [AppColors.libre, Color(0xFF14B8A6)],
                          ),
                          borderRadius: BorderRadius.circular(14),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.libre.withOpacity(0.3),
                              blurRadius: 16,
                              offset: const Offset(0, 6),
                            ),
                          ],
                        ),
                        child: const Text(
                          'CERRAR MESA',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                            letterSpacing: 2,
                            color: AppColors.background,
                          ),
                        ),
                      ),
                    ),
                  );
                },
              ),
            ],

            // ════════════════════════════════════════════════════
            // MODO INDIVIDUAL
            // ════════════════════════════════════════════════════
            if (_mode == 'individual') ...[
              const Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'COBRO POR COMENSAL',
                  style: TextStyle(
                    fontSize: 10,
                    color: AppColors.textMuted,
                    letterSpacing: 2,
                    fontWeight: FontWeight.w400,
                  ),
                ),
              ),
              const SizedBox(height: 12),
              ConstrainedBox(
                constraints: const BoxConstraints(maxHeight: 480),
                child: ListView.separated(
                  shrinkWrap: true,
                  physics: const ClampingScrollPhysics(),
                  itemCount: order.diners,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (_, i) => _buildDinerCard(context, order, i + 1),
                ),
              ),

              // Botón cerrar mesa cuando todos los que pidieron pagaron
              Builder(
                builder: (ctx) {
                  final withItems = List.generate(order.diners, (i) => i + 1)
                      .where(
                        (d) => order.allItems.any((item) => item.diner == d),
                      )
                      .toList();
                  final allPaid =
                      withItems.isNotEmpty &&
                      withItems.every((d) => _paidDiners.contains(d));
                  if (!allPaid) return const SizedBox.shrink();
                  return Padding(
                    padding: const EdgeInsets.only(top: 16),
                    child: GestureDetector(
                      onTap: _isClosingSale
                          ? null
                          : () async {
                              setState(() => _isClosingSale = true);
                              try {
                                final total = _totalWithTipsForMode(order);
                                await order.registrarVenta(
                                  mode: ChargeMode.porPersona,
                                  payments: _buildIndividualPayments(order),
                                  totalCuenta: total,
                                );
                                order.clearOrder();
                                if (context.mounted) Navigator.pop(context);
                              } catch (e) {
                                if (context.mounted) _showError(context, e);
                              } finally {
                                if (mounted)
                                  setState(() => _isClosingSale = false);
                              }
                            },
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [AppColors.libre, Color(0xFF14B8A6)],
                          ),
                          borderRadius: BorderRadius.circular(14),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.libre.withOpacity(0.3),
                              blurRadius: 16,
                              offset: const Offset(0, 6),
                            ),
                          ],
                        ),
                        child: const Text(
                          'CERRAR MESA',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                            letterSpacing: 2,
                            color: AppColors.background,
                          ),
                        ),
                      ),
                    ),
                  );
                },
              ),
            ],

            const SizedBox(height: 12),
            GestureDetector(
              onTap: () => Navigator.pop(context),
              child: const Padding(
                padding: EdgeInsets.symmetric(vertical: 8),
                child: Text(
                  'Cancelar',
                  style: TextStyle(
                    fontSize: 13,
                    color: AppColors.textSecondary,
                    fontWeight: FontWeight.w300,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Validaciones de confirmación ──────────────────────────────

  bool _canConfirmTotal(double total) {
    if (_method == null) return false;
    if (_method == 'mixto') return _mixtoValid(total, _cashCtrl);
    return true;
  }

  bool _canConfirmDiner(int dinerNum, double dinerTotal) {
    final m = _dinerMethods[dinerNum];
    if (m == null) return false;
    if (m == 'mixto') {
      return _mixtoValid(dinerTotal, _dinerCashCtrls[dinerNum]!);
    }
    return m == 'efectivo' || m == 'tarjeta';
  }

  bool _canConfirmEqDiner(int dinerNum, double monto) {
    final m = _eqDinerMethods[dinerNum];
    if (m == null) return false;
    if (m == 'mixto') return _mixtoValid(monto, _eqDinerCashCtrls[dinerNum]!);
    return m == 'efectivo' || m == 'tarjeta';
  }

  // ── Tarjeta de comensal (modo individual) ─────────────────────
  Widget _buildDinerCard(
    BuildContext context,
    OrderProvider order,
    int dinerNum,
  ) {
    final dinerItems = order.allItems
        .where((i) => i.diner == dinerNum)
        .toList();
    final dinerTotal = dinerItems.fold(0.0, (s, i) => s + i.price);
    final dinerTip = _individualTipForDiner(order, dinerNum, dinerTotal);
    final totalToPay = dinerTotal + dinerTip;
    final noItems = dinerItems.isEmpty;
    final paid = _paidDiners.contains(dinerNum);
    final method = _dinerMethods[dinerNum];

    // Crear controller si no existe
    _dinerCashCtrls.putIfAbsent(dinerNum, () => TextEditingController());
    _dinerTipCtrls.putIfAbsent(dinerNum, () => TextEditingController());

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: noItems
            ? AppColors.background.withOpacity(0.4)
            : paid
            ? AppColors.libre.withOpacity(0.06)
            : AppColors.background,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: noItems
              ? AppColors.surfaceElevated.withOpacity(0.4)
              : paid
              ? AppColors.libre.withOpacity(0.4)
              : AppColors.surfaceElevated,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Fila título
          Row(
            children: [
              Icon(
                noItems
                    ? Icons.remove_circle_outline
                    : paid
                    ? Icons.check_circle
                    : Icons.person_outline,
                size: 16,
                color: noItems
                    ? AppColors.textDisabled
                    : paid
                    ? AppColors.libre
                    : AppColors.textSecondary,
              ),
              const SizedBox(width: 8),
              Text(
                'Comensal $dinerNum',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  color: noItems
                      ? AppColors.textDisabled
                      : paid
                      ? AppColors.libre
                      : AppColors.textPrimary,
                ),
              ),
              const Spacer(),
              if (noItems)
                const Text(
                  'Sin platillos',
                  style: TextStyle(
                    fontSize: 11,
                    color: AppColors.textDisabled,
                    fontWeight: FontWeight.w300,
                  ),
                )
              else
                Text(
                  '\$${totalToPay.toStringAsFixed(2)}',
                  style: const TextStyle(
                    fontSize: 13,
                    color: AppColors.gold,
                    fontWeight: FontWeight.w400,
                  ),
                ),
            ],
          ),

          // Sin platillos
          if (noItems) ...[
            const SizedBox(height: 4),
            const Text(
              'Este comensal no ordenó. Se omite del cobro.',
              style: TextStyle(
                fontSize: 10,
                color: AppColors.textDisabled,
                fontWeight: FontWeight.w300,
                fontStyle: FontStyle.italic,
              ),
            ),
          ]
          // Ya pagado — muestra resumen y permite reabrir
          else if (paid) ...[
            const SizedBox(height: 6),
            Row(
              children: [
                Expanded(
                  child: Text(
                    method == 'mixto'
                        ? 'Cobrado · Mixto (\$${_parseAmount(_dinerCashCtrls[dinerNum]!).toStringAsFixed(2)} / \$${(totalToPay - _parseAmount(_dinerCashCtrls[dinerNum]!)).toStringAsFixed(2)})'
                        : 'Cobrado · ${method == 'tarjeta' ? 'Tarjeta' : 'Efectivo'}',
                    style: const TextStyle(
                      fontSize: 11,
                      color: AppColors.libre,
                      fontWeight: FontWeight.w300,
                    ),
                  ),
                ),
                // Botón para reabrir (arrepentirse)
                GestureDetector(
                  onTap: () => setState(() {
                    _paidDiners.remove(dinerNum);
                    _dinerMethods.remove(dinerNum);
                    _dinerCashCtrls[dinerNum]!.clear();
                  }),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceElevated,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Text(
                      'Cambiar',
                      style: TextStyle(
                        fontSize: 10,
                        color: AppColors.textSecondary,
                        fontWeight: FontWeight.w400,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ]
          // Pendiente de cobro
          else ...[
            const SizedBox(height: 10),
            // Botones de método
            Row(
              children: [
                Expanded(
                  child: _SmallMethodBtn(
                    icon: Icons.payments_outlined,
                    label: 'Efectivo',
                    selected: method == 'efectivo',
                    onTap: () => setState(() {
                      _dinerMethods[dinerNum] = 'efectivo';
                      _dinerCashCtrls[dinerNum]!.clear();
                    }),
                  ),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: _SmallMethodBtn(
                    icon: Icons.credit_card_outlined,
                    label: 'Tarjeta',
                    selected: method == 'tarjeta',
                    onTap: () => setState(() {
                      _dinerMethods[dinerNum] = 'tarjeta';
                      _dinerCashCtrls[dinerNum]!.clear();
                    }),
                  ),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: _SmallMethodBtn(
                    icon: Icons.compare_arrows_outlined,
                    label: 'Mixto',
                    selected: method == 'mixto',
                    onTap: () => setState(() {
                      _dinerMethods[dinerNum] = 'mixto';
                      _dinerCashCtrls[dinerNum]!.clear();
                    }),
                  ),
                ),
              ],
            ),
            if (_tipScope == 'per_diner') ...[
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: _SmallMethodBtn(
                      icon: Icons.payments_outlined,
                      label: 'Tip efectivo',
                      selected:
                          (_dinerTipMethods[dinerNum] ?? 'efectivo') ==
                          'efectivo',
                      onTap: () => setState(() {
                        _dinerTipMethods[dinerNum] = 'efectivo';
                        _dinerTipCardModes[dinerNum] = 'amount';
                        final txt = _dinerTipCtrls[dinerNum]!.text;
                        if (txt.contains('%')) {
                          _dinerTipCtrls[dinerNum]!.text = txt.replaceAll(
                            '%',
                            '',
                          );
                        }
                      }),
                    ),
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: _SmallMethodBtn(
                      icon: Icons.credit_card_outlined,
                      label: 'Tip tarjeta',
                      selected:
                          (_dinerTipMethods[dinerNum] ?? 'efectivo') ==
                          'tarjeta',
                      onTap: () => setState(() {
                        _dinerTipMethods[dinerNum] = 'tarjeta';
                        _dinerTipCardModes.putIfAbsent(
                          dinerNum,
                          () => 'amount',
                        );
                      }),
                    ),
                  ),
                ],
              ),
              if ((_dinerTipMethods[dinerNum] ?? 'efectivo') == 'tarjeta') ...[
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: _SmallMethodBtn(
                        icon: Icons.attach_money,
                        label: 'Cantidad',
                        selected:
                            (_dinerTipCardModes[dinerNum] ?? 'amount') ==
                            'amount',
                        onTap: () => setState(
                          () => _dinerTipCardModes[dinerNum] = 'amount',
                        ),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: _SmallMethodBtn(
                        icon: Icons.percent,
                        label: 'Porcentaje',
                        selected:
                            (_dinerTipCardModes[dinerNum] ?? 'amount') ==
                            'percent',
                        onTap: () => setState(
                          () => _dinerTipCardModes[dinerNum] = 'percent',
                        ),
                      ),
                    ),
                  ],
                ),
              ],
              const SizedBox(height: 8),
              TextField(
                controller: _dinerTipCtrls[dinerNum],
                onChanged: (_) => setState(() {}),
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                inputFormatters: [
                  FilteringTextInputFormatter.allow(
                    RegExp(
                      (_dinerTipMethods[dinerNum] ?? 'efectivo') == 'tarjeta' &&
                              (_dinerTipCardModes[dinerNum] ?? 'amount') ==
                                  'percent'
                          ? r'[\d.,]'
                          : r'[\d.,]',
                    ),
                  ),
                ],
                style: const TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 13,
                  fontWeight: FontWeight.w300,
                ),
                decoration: InputDecoration(
                  hintText:
                      (_dinerTipMethods[dinerNum] ?? 'efectivo') == 'tarjeta'
                      ? ((_dinerTipCardModes[dinerNum] ?? 'amount') == 'percent'
                            ? 'Porcentaje'
                            : 'Cantidad')
                      : 'Cantidad',
                  hintStyle: const TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 12,
                  ),
                  prefixText:
                      (_dinerTipMethods[dinerNum] ?? 'efectivo') == 'tarjeta' &&
                          (_dinerTipCardModes[dinerNum] ?? 'amount') ==
                              'percent'
                      ? null
                      : '\$  ',
                  prefixStyle:
                      (_dinerTipMethods[dinerNum] ?? 'efectivo') == 'tarjeta' &&
                          (_dinerTipCardModes[dinerNum] ?? 'amount') ==
                              'percent'
                      ? null
                      : const TextStyle(color: AppColors.gold, fontSize: 13),
                  suffixText:
                      (_dinerTipMethods[dinerNum] ?? 'efectivo') == 'tarjeta' &&
                          (_dinerTipCardModes[dinerNum] ?? 'amount') ==
                              'percent'
                      ? '%'
                      : null,
                  suffixStyle: const TextStyle(
                    color: AppColors.gold,
                    fontSize: 12,
                  ),
                  filled: true,
                  fillColor: AppColors.surfaceElevated,
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 10,
                  ),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: BorderSide.none,
                  ),
                ),
              ),
            ],
            if (dinerTip > 0) ...[
              const SizedBox(height: 6),
              Text(
                'Propina: \$${dinerTip.toStringAsFixed(2)}',
                style: const TextStyle(
                  fontSize: 11,
                  color: AppColors.textMuted,
                  fontWeight: FontWeight.w300,
                ),
              ),
            ],

            if (method == 'mixto') ...[
              const SizedBox(height: 10),
              _MixtoPanel(
                total: totalToPay,
                cashCtrl: _dinerCashCtrls[dinerNum]!,
                onChanged: () => setState(() {}),
              ),
            ],

            // Botón cobrar
            if (_canConfirmDiner(dinerNum, totalToPay)) ...[
              const SizedBox(height: 10),
              GestureDetector(
                onTap: () => _confirmDiner(context, order, dinerNum),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [AppColors.gold, AppColors.goldLight],
                    ),
                    borderRadius: BorderRadius.circular(10),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.gold.withOpacity(0.25),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.print_outlined,
                        size: 15,
                        color: AppColors.background,
                      ),
                      SizedBox(width: 6),
                      Text(
                        'PAGADO E IMPRIMIR',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                          letterSpacing: 1,
                          color: AppColors.background,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ],
      ),
    );
  }

  Widget _buildEquitativoDinerCard(
    BuildContext context,
    OrderProvider order,
    int dinerNum,
    double monto,
  ) {
    final dinerTip = _equitativoTipForDiner(order, dinerNum, monto);
    final totalToPay = monto + dinerTip;
    final paid = _paidEqDiners.contains(dinerNum);
    final method = _eqDinerMethods[dinerNum];
    _eqDinerCashCtrls.putIfAbsent(dinerNum, () => TextEditingController());
    _eqDinerTipCtrls.putIfAbsent(dinerNum, () => TextEditingController());
    final cashCtrl = _eqDinerCashCtrls[dinerNum]!;
    final cash = method == 'mixto' ? _parseAmount(cashCtrl) : null;
    final card = method == 'mixto' ? _cardAmount(totalToPay, cash ?? 0) : null;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: paid ? AppColors.libre.withOpacity(0.06) : AppColors.background,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: paid
              ? AppColors.libre.withOpacity(0.4)
              : AppColors.surfaceElevated,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                paid ? Icons.check_circle : Icons.person_outline,
                size: 16,
                color: paid ? AppColors.libre : AppColors.textSecondary,
              ),
              const SizedBox(width: 8),
              Text(
                'Comensal $dinerNum',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  color: paid ? AppColors.libre : AppColors.textPrimary,
                ),
              ),
              const Spacer(),
              Text(
                '\$${totalToPay.toStringAsFixed(2)}',
                style: const TextStyle(
                  fontSize: 13,
                  color: AppColors.gold,
                  fontWeight: FontWeight.w400,
                ),
              ),
            ],
          ),
          if (paid) ...[
            const SizedBox(height: 6),
            Row(
              children: [
                Expanded(
                  child: Text(
                    method == 'mixto'
                        ? 'Cobrado · Mixto (\$${(cash ?? 0).toStringAsFixed(2)} / \$${(card ?? 0).toStringAsFixed(2)})'
                        : 'Cobrado · ${method == 'tarjeta' ? 'Tarjeta' : 'Efectivo'}',
                    style: const TextStyle(
                      fontSize: 11,
                      color: AppColors.libre,
                      fontWeight: FontWeight.w300,
                    ),
                  ),
                ),
                GestureDetector(
                  onTap: () => setState(() {
                    _paidEqDiners.remove(dinerNum);
                    _eqDinerMethods.remove(dinerNum);
                    cashCtrl.clear();
                  }),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceElevated,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Text(
                      'Cambiar',
                      style: TextStyle(
                        fontSize: 10,
                        color: AppColors.textSecondary,
                        fontWeight: FontWeight.w400,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ] else ...[
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: _SmallMethodBtn(
                    icon: Icons.payments_outlined,
                    label: 'Efectivo',
                    selected: method == 'efectivo',
                    onTap: () => setState(() {
                      _eqDinerMethods[dinerNum] = 'efectivo';
                      cashCtrl.clear();
                    }),
                  ),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: _SmallMethodBtn(
                    icon: Icons.credit_card_outlined,
                    label: 'Tarjeta',
                    selected: method == 'tarjeta',
                    onTap: () => setState(() {
                      _eqDinerMethods[dinerNum] = 'tarjeta';
                      cashCtrl.clear();
                    }),
                  ),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: _SmallMethodBtn(
                    icon: Icons.compare_arrows_outlined,
                    label: 'Mixto',
                    selected: method == 'mixto',
                    onTap: () => setState(() {
                      _eqDinerMethods[dinerNum] = 'mixto';
                      cashCtrl.clear();
                    }),
                  ),
                ),
              ],
            ),
            if (_tipScope == 'per_diner') ...[
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: _SmallMethodBtn(
                      icon: Icons.payments_outlined,
                      label: 'Tip efectivo',
                      selected:
                          (_eqDinerTipMethods[dinerNum] ?? 'efectivo') ==
                          'efectivo',
                      onTap: () => setState(() {
                        _eqDinerTipMethods[dinerNum] = 'efectivo';
                        _eqDinerTipCardModes[dinerNum] = 'amount';
                        final txt = _eqDinerTipCtrls[dinerNum]!.text;
                        if (txt.contains('%')) {
                          _eqDinerTipCtrls[dinerNum]!.text = txt.replaceAll(
                            '%',
                            '',
                          );
                        }
                      }),
                    ),
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: _SmallMethodBtn(
                      icon: Icons.credit_card_outlined,
                      label: 'Tip tarjeta',
                      selected:
                          (_eqDinerTipMethods[dinerNum] ?? 'efectivo') ==
                          'tarjeta',
                      onTap: () => setState(() {
                        _eqDinerTipMethods[dinerNum] = 'tarjeta';
                        _eqDinerTipCardModes.putIfAbsent(
                          dinerNum,
                          () => 'amount',
                        );
                      }),
                    ),
                  ),
                ],
              ),
              if ((_eqDinerTipMethods[dinerNum] ?? 'efectivo') ==
                  'tarjeta') ...[
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: _SmallMethodBtn(
                        icon: Icons.attach_money,
                        label: 'Cantidad',
                        selected:
                            (_eqDinerTipCardModes[dinerNum] ?? 'amount') ==
                            'amount',
                        onTap: () => setState(
                          () => _eqDinerTipCardModes[dinerNum] = 'amount',
                        ),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: _SmallMethodBtn(
                        icon: Icons.percent,
                        label: 'Porcentaje',
                        selected:
                            (_eqDinerTipCardModes[dinerNum] ?? 'amount') ==
                            'percent',
                        onTap: () => setState(
                          () => _eqDinerTipCardModes[dinerNum] = 'percent',
                        ),
                      ),
                    ),
                  ],
                ),
              ],
              const SizedBox(height: 8),
              TextField(
                controller: _eqDinerTipCtrls[dinerNum],
                onChanged: (_) => setState(() {}),
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                inputFormatters: [
                  FilteringTextInputFormatter.allow(
                    RegExp(
                      (_eqDinerTipMethods[dinerNum] ?? 'efectivo') ==
                                  'tarjeta' &&
                              (_eqDinerTipCardModes[dinerNum] ?? 'amount') ==
                                  'percent'
                          ? r'[\d.,]'
                          : r'[\d.,]',
                    ),
                  ),
                ],
                style: const TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 13,
                  fontWeight: FontWeight.w300,
                ),
                decoration: InputDecoration(
                  hintText:
                      (_eqDinerTipMethods[dinerNum] ?? 'efectivo') == 'tarjeta'
                      ? ((_eqDinerTipCardModes[dinerNum] ?? 'amount') ==
                                'percent'
                            ? 'Porcentaje'
                            : 'Cantidad')
                      : 'Cantidad',
                  hintStyle: const TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 12,
                  ),
                  prefixText:
                      (_eqDinerTipMethods[dinerNum] ?? 'efectivo') ==
                              'tarjeta' &&
                          (_eqDinerTipCardModes[dinerNum] ?? 'amount') ==
                              'percent'
                      ? null
                      : '\$  ',
                  prefixStyle:
                      (_eqDinerTipMethods[dinerNum] ?? 'efectivo') ==
                              'tarjeta' &&
                          (_eqDinerTipCardModes[dinerNum] ?? 'amount') ==
                              'percent'
                      ? null
                      : const TextStyle(color: AppColors.gold, fontSize: 13),
                  suffixText:
                      (_eqDinerTipMethods[dinerNum] ?? 'efectivo') ==
                              'tarjeta' &&
                          (_eqDinerTipCardModes[dinerNum] ?? 'amount') ==
                              'percent'
                      ? '%'
                      : null,
                  suffixStyle: const TextStyle(
                    color: AppColors.gold,
                    fontSize: 12,
                  ),
                  filled: true,
                  fillColor: AppColors.surfaceElevated,
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 10,
                  ),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: BorderSide.none,
                  ),
                ),
              ),
            ],
            if (dinerTip > 0) ...[
              const SizedBox(height: 6),
              Text(
                'Propina: \$${dinerTip.toStringAsFixed(2)}',
                style: const TextStyle(
                  fontSize: 11,
                  color: AppColors.textMuted,
                  fontWeight: FontWeight.w300,
                ),
              ),
            ],
            if (method == 'mixto') ...[
              const SizedBox(height: 10),
              _MixtoPanel(
                total: totalToPay,
                cashCtrl: cashCtrl,
                onChanged: () => setState(() {}),
              ),
            ],
            if (_canConfirmEqDiner(dinerNum, totalToPay)) ...[
              const SizedBox(height: 10),
              GestureDetector(
                onTap: () => _confirmEquitativoDiner(context, order, dinerNum),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [AppColors.gold, AppColors.goldLight],
                    ),
                    borderRadius: BorderRadius.circular(10),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.gold.withOpacity(0.25),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.print_outlined,
                        size: 15,
                        color: AppColors.background,
                      ),
                      SizedBox(width: 6),
                      Text(
                        'PAGADO E IMPRIMIR',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                          letterSpacing: 1,
                          color: AppColors.background,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ],
      ),
    );
  }

  Widget _buildPayBtn({required bool enabled}) => AnimatedContainer(
    duration: const Duration(milliseconds: 250),
    width: double.infinity,
    padding: const EdgeInsets.symmetric(vertical: 16),
    decoration: BoxDecoration(
      gradient: enabled
          ? const LinearGradient(colors: [AppColors.gold, AppColors.goldLight])
          : null,
      color: enabled ? null : AppColors.surfaceElevated,
      borderRadius: BorderRadius.circular(16),
      boxShadow: enabled
          ? [
              BoxShadow(
                color: AppColors.gold.withOpacity(0.3),
                blurRadius: 20,
                offset: const Offset(0, 8),
              ),
            ]
          : null,
    ),
    child: Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(
          Icons.print_outlined,
          size: 18,
          color: enabled ? AppColors.background : AppColors.textDisabled,
        ),
        const SizedBox(width: 8),
        Text(
          'COBRAR E IMPRIMIR TICKET',
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w500,
            letterSpacing: 1.5,
            color: enabled ? AppColors.background : AppColors.textDisabled,
          ),
        ),
      ],
    ),
  );
}

// ─────────────────────────────────────────────────────────────
// WIDGET: Panel de pago mixto (campo efectivo + cálculo tarjeta)
// ─────────────────────────────────────────────────────────────
class _MixtoPanel extends StatelessWidget {
  final double total;
  final TextEditingController cashCtrl;
  final VoidCallback onChanged;

  const _MixtoPanel({
    required this.total,
    required this.cashCtrl,
    required this.onChanged,
  });

  double get _cash =>
      double.tryParse(cashCtrl.text.replaceAll(',', '.')) ?? 0.0;
  double get _card => (total - _cash).clamp(0, total);
  bool get _valid => _cash > 0 && _cash < total - 0.001;
  bool get _exceeds => _cash > total + 0.001;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.background,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: _exceeds
              ? AppColors.ocupado.withOpacity(0.6)
              : AppColors.gold.withOpacity(0.3),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Total a pagar
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Total a cubrir',
                style: TextStyle(
                  fontSize: 11,
                  color: AppColors.textSecondary,
                  fontWeight: FontWeight.w300,
                ),
              ),
              Text(
                '\$${total.toStringAsFixed(2)}',
                style: const TextStyle(
                  fontSize: 11,
                  color: AppColors.textSecondary,
                  fontWeight: FontWeight.w300,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Campo de efectivo
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.surfaceElevated,
                  border: Border.all(color: AppColors.gold.withOpacity(0.3)),
                ),
                child: const Icon(
                  Icons.payments_outlined,
                  size: 16,
                  color: AppColors.gold,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: TextField(
                  controller: cashCtrl,
                  onChanged: (_) => onChanged(),
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(RegExp(r'[\d.,]')),
                  ],
                  style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 15,
                    fontWeight: FontWeight.w300,
                  ),
                  decoration: InputDecoration(
                    hintText: 'Monto en efectivo',
                    hintStyle: const TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 13,
                    ),
                    prefixText: '\$  ',
                    prefixStyle: const TextStyle(
                      color: AppColors.gold,
                      fontSize: 15,
                    ),
                    filled: true,
                    fillColor: AppColors.surfaceElevated,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 10,
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: BorderSide.none,
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: const BorderSide(
                        color: AppColors.gold,
                        width: 1.5,
                      ),
                    ),
                    errorBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: BorderSide(
                        color: AppColors.ocupado.withOpacity(0.7),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),

          // Mensaje de error si supera el total
          if (_exceeds) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                Icon(
                  Icons.warning_amber_outlined,
                  size: 14,
                  color: AppColors.ocupado.withOpacity(0.8),
                ),
                const SizedBox(width: 6),
                Text(
                  'El efectivo no puede superar \$${total.toStringAsFixed(2)}',
                  style: TextStyle(
                    fontSize: 11,
                    color: AppColors.ocupado.withOpacity(0.8),
                    fontWeight: FontWeight.w300,
                  ),
                ),
              ],
            ),
          ],

          // Resto en tarjeta (solo si hay algo válido)
          if (_valid) ...[
            const SizedBox(height: 12),
            const Divider(color: AppColors.border, height: 1),
            const SizedBox(height: 12),
            Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: AppColors.surfaceElevated,
                    border: Border.all(color: AppColors.gold.withOpacity(0.3)),
                  ),
                  child: const Icon(
                    Icons.credit_card_outlined,
                    size: 16,
                    color: AppColors.gold,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Resto en tarjeta',
                        style: TextStyle(
                          fontSize: 11,
                          color: AppColors.textSecondary,
                          fontWeight: FontWeight.w300,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '\$${_card.toStringAsFixed(2)}',
                        style: TextStyle(
                          fontSize: 18,
                          color: AppColors.gold,
                          fontWeight: FontWeight.w300,
                          shadows: [
                            Shadow(
                              color: AppColors.gold.withOpacity(0.3),
                              blurRadius: 6,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                // Check de validación
                Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: AppColors.libre.withOpacity(0.15),
                    border: Border.all(color: AppColors.libre.withOpacity(0.4)),
                  ),
                  child: const Icon(
                    Icons.check,
                    size: 14,
                    color: AppColors.libre,
                  ),
                ),
              ],
            ),
          ],

          // Si efectivo cubre todo el total (no hay tarjeta)
          if (!_exceeds &&
              _cash > 0 &&
              _cash >= total - 0.001 &&
              cashCtrl.text.isNotEmpty) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: AppColors.ocupado.withOpacity(0.08),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.ocupado.withOpacity(0.3)),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.info_outline,
                    size: 14,
                    color: AppColors.ocupado.withOpacity(0.8),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'El monto cubre el total. Si pagas todo en efectivo, elige "Efectivo" arriba.',
                      style: TextStyle(
                        fontSize: 10,
                        color: AppColors.ocupado.withOpacity(0.8),
                        fontWeight: FontWeight.w300,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// WIDGETS auxiliares
// ─────────────────────────────────────────────────────────────

class _ModeChip extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;
  const _ModeChip({
    required this.label,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    child: AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 14),
      decoration: BoxDecoration(
        color: selected
            ? AppColors.gold.withOpacity(0.1)
            : AppColors.background,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: selected ? AppColors.gold : AppColors.surfaceElevated,
          width: selected ? 1.5 : 1,
        ),
      ),
      child: Row(
        children: [
          Icon(
            icon,
            size: 16,
            color: selected ? AppColors.gold : AppColors.textSecondary,
          ),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w400,
                color: selected ? AppColors.gold : AppColors.textSecondary,
              ),
            ),
          ),
        ],
      ),
    ),
  );
}

class _SmallMethodBtn extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _SmallMethodBtn({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    child: AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 6),
      decoration: BoxDecoration(
        color: selected
            ? AppColors.gold.withOpacity(0.1)
            : AppColors.surfaceElevated,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: selected ? AppColors.gold : Colors.transparent,
          width: 1.5,
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            size: 14,
            color: selected ? AppColors.gold : AppColors.textSecondary,
          ),
          const SizedBox(height: 3),
          Text(
            label,
            style: TextStyle(
              fontSize: 10,
              color: selected ? AppColors.gold : AppColors.textSecondary,
            ),
          ),
        ],
      ),
    ),
  );
}

class _PaymentOption extends StatelessWidget {
  final IconData icon;
  final String label;
  final String subtitle;
  final bool selected;
  final VoidCallback onTap;
  const _PaymentOption({
    required this.icon,
    required this.label,
    required this.subtitle,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    child: AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: selected
            ? AppColors.gold.withOpacity(0.08)
            : AppColors.background,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: selected ? AppColors.gold : AppColors.surfaceElevated,
          width: selected ? 1.5 : 1,
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: selected
                  ? AppColors.gold.withOpacity(0.15)
                  : AppColors.surfaceElevated,
              border: Border.all(
                color: selected
                    ? AppColors.gold.withOpacity(0.4)
                    : Colors.transparent,
              ),
            ),
            child: Icon(
              icon,
              color: selected ? AppColors.gold : AppColors.textSecondary,
              size: 20,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 14,
                    color: selected ? AppColors.gold : AppColors.textPrimary,
                    fontWeight: FontWeight.w400,
                  ),
                ),
                Text(
                  subtitle,
                  style: const TextStyle(
                    fontSize: 11,
                    color: AppColors.textMuted,
                    fontWeight: FontWeight.w300,
                  ),
                ),
              ],
            ),
          ),
          AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            width: 20,
            height: 20,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: selected ? AppColors.gold : Colors.transparent,
              border: Border.all(
                color: selected ? AppColors.gold : AppColors.surfaceElevated,
                width: 2,
              ),
            ),
            child: selected
                ? const Icon(Icons.check, size: 12, color: AppColors.background)
                : null,
          ),
        ],
      ),
    ),
  );
}

class _SectionLabel extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color color;
  const _SectionLabel({
    required this.label,
    required this.icon,
    required this.color,
  });
  @override
  Widget build(BuildContext context) => Row(
    children: [
      Icon(icon, size: 14, color: color),
      const SizedBox(width: 6),
      Text(
        label,
        style: TextStyle(
          fontSize: 10,
          color: color,
          letterSpacing: 1.5,
          fontWeight: FontWeight.w500,
        ),
      ),
    ],
  );
}

class _TotalRow extends StatelessWidget {
  final String label;
  final double value;
  final Color color;
  const _TotalRow({
    required this.label,
    required this.value,
    required this.color,
  });
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 3),
    child: Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: 13,
            color: color,
            fontWeight: FontWeight.w300,
          ),
        ),
        Text(
          '\$${value.toStringAsFixed(2)}',
          style: TextStyle(
            fontSize: 13,
            color: color,
            fontWeight: FontWeight.w300,
          ),
        ),
      ],
    ),
  );
}

class _ActionBtn extends StatelessWidget {
  final String label;
  final IconData icon;
  final LinearGradient? gradient;
  final bool disabled;
  final VoidCallback? onTap;
  const _ActionBtn({
    required this.label,
    required this.icon,
    this.gradient,
    this.disabled = false,
    this.onTap,
  });
  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: disabled ? null : onTap,
    child: AnimatedContainer(
      duration: const Duration(milliseconds: 250),
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 15),
      decoration: BoxDecoration(
        gradient: disabled ? null : gradient,
        color: disabled ? AppColors.surface : null,
        borderRadius: BorderRadius.circular(16),
        boxShadow: disabled || gradient == null
            ? null
            : [
                BoxShadow(
                  color: AppColors.gold.withOpacity(0.3),
                  blurRadius: 20,
                  offset: const Offset(0, 8),
                ),
              ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            icon,
            size: 18,
            color: disabled ? AppColors.textDisabled : AppColors.background,
          ),
          const SizedBox(width: 8),
          Text(
            label,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w500,
              letterSpacing: 1.5,
              color: disabled ? AppColors.textDisabled : AppColors.background,
            ),
          ),
        ],
      ),
    ),
  );
}

class _ConfirmDialog extends StatelessWidget {
  final IconData icon;
  final String title;
  final String body;
  final String confirmLabel;
  final VoidCallback onConfirm;
  const _ConfirmDialog({
    required this.icon,
    required this.title,
    required this.body,
    required this.confirmLabel,
    required this.onConfirm,
  });
  @override
  Widget build(BuildContext context) => Dialog(
    backgroundColor: Colors.transparent,
    child: Container(
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppColors.surfaceElevated),
        boxShadow: [
          BoxShadow(color: AppColors.gold.withOpacity(0.1), blurRadius: 40),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.gold.withOpacity(0.1),
              border: Border.all(
                color: AppColors.gold.withOpacity(0.4),
                width: 2,
              ),
            ),
            child: Icon(icon, color: AppColors.gold, size: 32),
          ),
          const SizedBox(height: 20),
          Text(
            title,
            style: const TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w300,
              color: AppColors.gold,
              letterSpacing: 1,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            body,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 13,
              color: AppColors.textSecondary,
              fontWeight: FontWeight.w300,
            ),
          ),
          const SizedBox(height: 28),
          GestureDetector(
            onTap: onConfirm,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 14),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppColors.gold, AppColors.goldLight],
                ),
                borderRadius: BorderRadius.circular(14),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.gold.withOpacity(0.3),
                    blurRadius: 16,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              child: Text(
                confirmLabel,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  letterSpacing: 2,
                  color: AppColors.background,
                ),
              ),
            ),
          ),
          const SizedBox(height: 10),
          GestureDetector(
            onTap: () => Navigator.pop(context),
            child: const Padding(
              padding: EdgeInsets.symmetric(vertical: 10),
              child: Text(
                'Cancelar',
                style: TextStyle(
                  fontSize: 13,
                  color: AppColors.textSecondary,
                  fontWeight: FontWeight.w300,
                ),
              ),
            ),
          ),
        ],
      ),
    ),
  );
}
