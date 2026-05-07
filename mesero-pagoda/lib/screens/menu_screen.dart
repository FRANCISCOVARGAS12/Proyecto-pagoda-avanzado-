// lib/screens/menu_screen.dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../theme/app_theme.dart';
import '../models/models.dart';
import '../providers/order_provider.dart';
import 'login_screen.dart';
import 'order_summary_screen.dart';

// ignore: unused_element
const List<String> kCategories = [
  'ENTRADAS',
  'HOT POT',
  'PARRILLADAS',
  'ROLLOS',
  'KIDS',
  'POSTRES',
  'BEBIDAS',
];

// ignore: unused_element
const List<Map<String, dynamic>> kMenu = [
  {
    'name': 'Gyoza de Cerdo',
    'price': 89.0,
    'category': 'ENTRADAS',
    'desc': '6 unidades rellenas',
  },
  {
    'name': 'Edamame',
    'price': 65.0,
    'category': 'ENTRADAS',
    'desc': 'Habas de soya con sal marina',
  },
  {
    'name': 'Spring Rolls',
    'price': 79.0,
    'category': 'ENTRADAS',
    'desc': 'Rollitos primavera vegetales',
  },
  {
    'name': 'Calamares Fritos',
    'price': 120.0,
    'category': 'ENTRADAS',
    'desc': 'Con salsa especial',
  },
  {
    'name': 'Hot Pot Imperial',
    'price': 280.0,
    'category': 'HOT POT',
    'desc': 'Caldo picante con mariscos',
  },
  {
    'name': 'Hot Pot Vegetariano',
    'price': 220.0,
    'category': 'HOT POT',
    'desc': 'Caldo miso con vegetales',
  },
  {
    'name': 'Hot Pot de Res',
    'price': 260.0,
    'category': 'HOT POT',
    'desc': 'Caldo de hueso premium',
  },
  {
    'name': 'Parrillada Mixta',
    'price': 350.0,
    'category': 'PARRILLADAS',
    'desc': 'Res, cerdo y pollo',
  },
  {
    'name': 'Parrillada Mariscos',
    'price': 420.0,
    'category': 'PARRILLADAS',
    'desc': 'Camarones, pulpo y pescado',
  },
  {
    'name': 'California Roll',
    'price': 140.0,
    'category': 'ROLLOS',
    'desc': 'Cangrejo, aguacate y pepino',
  },
  {
    'name': 'Dragon Roll',
    'price': 180.0,
    'category': 'ROLLOS',
    'desc': 'Tempura de camarón con anguila',
  },
  {
    'name': 'Spicy Tuna Roll',
    'price': 160.0,
    'category': 'ROLLOS',
    'desc': 'Atún picante con sriracha',
  },
  {
    'name': 'Mini Gyoza Kids',
    'price': 60.0,
    'category': 'KIDS',
    'desc': '4 gyozas con salsa dulce',
  },
  {
    'name': 'Nuggets de Pollo',
    'price': 70.0,
    'category': 'KIDS',
    'desc': 'Con papas fritas',
  },
  {
    'name': 'Mochi Ice Cream',
    'price': 80.0,
    'category': 'POSTRES',
    'desc': '3 unidades sabores variados',
  },
  {
    'name': 'Cheesecake Matcha',
    'price': 100.0,
    'category': 'POSTRES',
    'desc': 'Con chocolate blanco',
  },
  {
    'name': 'Té Verde',
    'price': 35.0,
    'category': 'BEBIDAS',
    'desc': 'Té verde japonés caliente',
  },
  {
    'name': 'Limonada de Jengibre',
    'price': 50.0,
    'category': 'BEBIDAS',
    'desc': 'Limonada casera',
  },
  {
    'name': 'Sake de la Casa',
    'price': 150.0,
    'category': 'BEBIDAS',
    'desc': 'Sake frío o caliente',
  },
];

class MenuScreen extends StatefulWidget {
  const MenuScreen({super.key});
  @override
  State<MenuScreen> createState() => _MenuScreenState();
}

class _MenuScreenState extends State<MenuScreen>
    with SingleTickerProviderStateMixin {
  String _cat = 'ENTRADAS';
  late AnimationController _fadeCtrl;
  late Animation<double> _fadeAnim;
  bool _redirectingToLogin = false;

  @override
  void initState() {
    super.initState();
    _fadeCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 350),
    )..forward();
    _fadeAnim = CurvedAnimation(parent: _fadeCtrl, curve: Curves.easeOut);
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;
      final order = context.read<OrderProvider>();
      await order.refreshMenu();
      if (!mounted) return;
      final categories = _categories(order);
      if (categories.isNotEmpty && !categories.contains(_cat)) {
        setState(() => _cat = categories.first);
      }
    });
  }

  @override
  void dispose() {
    _fadeCtrl.dispose();
    super.dispose();
  }

  void _switchCat(String c) {
    setState(() => _cat = c);
    _fadeCtrl
      ..reset()
      ..forward();
  }

  List<String> _categories(OrderProvider order) => order.menuCategories;

  List<Map<String, dynamic>> _items(OrderProvider order) {
    return order.menuItems.where((e) => e['category'] == _cat).toList();
  }

  void _moveCategory(int offset, OrderProvider order) {
    final categories = _categories(order);
    final current = categories.indexOf(_cat);
    if (current < 0) return;
    final next = (current + offset).clamp(0, categories.length - 1);
    if (next == current) return;
    _switchCat(categories[next]);
  }

  void _onHorizontalSwipe(DragEndDetails details, OrderProvider order) {
    final v = details.primaryVelocity ?? 0;
    if (v < -120) _moveCategory(1, order); // izquierda -> siguiente categoría
    if (v > 120) _moveCategory(-1, order); // derecha -> categoría anterior
  }

  // ── Snackbar helper — texto y color siempre visibles ──────────
  void _showAddedSnack(String itemName) {
    ScaffoldMessenger.of(context)
      ..clearSnackBars()
      ..showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(
                Icons.check_circle_outline,
                color: AppColors.gold,
                size: 18,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  '$itemName agregado a la orden',
                  style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 13,
                    fontWeight: FontWeight.w400,
                  ),
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
  }

  void _showAddGuestsDialog(OrderProvider order) {
    final table = order.currentTable;
    if (table == null) return;
    int add = 1;
    final maxAdd = (20 - order.diners).clamp(0, 20);
    if (maxAdd == 0) return;

    showDialog(
      context: context,
      barrierColor: Colors.black.withOpacity(0.8),
      builder: (_) => StatefulBuilder(
        builder: (ctx, setS) => Dialog(
          backgroundColor: Colors.transparent,
          child: Container(
            padding: const EdgeInsets.all(26),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: AppColors.surfaceElevated),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'Agregar Comensales',
                  style: TextStyle(
                    fontSize: 18,
                    color: AppColors.gold,
                    fontWeight: FontWeight.w300,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Actualmente: ${order.diners}',
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                    fontWeight: FontWeight.w300,
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    IconButton(
                      onPressed: add > 1 ? () => setS(() => add--) : null,
                      icon: const Icon(
                        Icons.remove_circle_outline,
                        color: AppColors.gold,
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 18,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.background,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: AppColors.surfaceElevated),
                      ),
                      child: Text(
                        '+$add',
                        style: const TextStyle(
                          fontSize: 24,
                          color: AppColors.gold,
                          fontWeight: FontWeight.w300,
                        ),
                      ),
                    ),
                    IconButton(
                      onPressed: add < maxAdd ? () => setS(() => add++) : null,
                      icon: const Icon(
                        Icons.add_circle_outline,
                        color: AppColors.gold,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  'Total nuevo: ${order.diners + add}',
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textMuted,
                    fontWeight: FontWeight.w300,
                  ),
                ),
                const SizedBox(height: 18),
                GestureDetector(
                  onTap: () {
                    order.updateGuests(table, order.diners + add);
                    Navigator.pop(ctx);
                  },
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 13),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [AppColors.gold, AppColors.goldLight],
                      ),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Text(
                      'GUARDAR',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 12,
                        color: AppColors.background,
                        fontWeight: FontWeight.w500,
                        letterSpacing: 1.4,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                GestureDetector(
                  onTap: () => Navigator.pop(ctx),
                  child: const Padding(
                    padding: EdgeInsets.symmetric(vertical: 6),
                    child: Text(
                      'Cancelar',
                      style: TextStyle(
                        fontSize: 12,
                        color: AppColors.textSecondary,
                        fontWeight: FontWeight.w300,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // ── Modal agregar platillo ────────────────────────────────────
  void _showAddModal(Map<String, dynamic> item, OrderProvider order) {
    int selectedDiner = 1;
    String notes = '';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => StatefulBuilder(
        builder: (ctx, setS) => Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(ctx).viewInsets.bottom,
          ),
          child: Container(
            padding: const EdgeInsets.fromLTRB(24, 28, 24, 36),
            decoration: const BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Handle
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    margin: const EdgeInsets.only(bottom: 20),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceElevated,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),

                // Nombre y precio
                Text(
                  item['name'],
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
                  item['desc'],
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                    fontWeight: FontWeight.w300,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  '\$${(item['price'] as double).toStringAsFixed(2)}',
                  style: const TextStyle(
                    fontSize: 18,
                    color: AppColors.gold,
                    fontWeight: FontWeight.w400,
                  ),
                ),
                const SizedBox(height: 22),

                // Selector comensal
                const Text(
                  'ASIGNAR A COMENSAL',
                  style: TextStyle(
                    fontSize: 10,
                    color: AppColors.textMuted,
                    letterSpacing: 2,
                    fontWeight: FontWeight.w400,
                  ),
                ),
                const SizedBox(height: 10),
                SizedBox(
                  height: 48,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    children: [
                      ...List.generate(
                        order.diners,
                        (i) => GestureDetector(
                          onTap: () => setS(() => selectedDiner = i + 1),
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 200),
                            margin: const EdgeInsets.only(right: 8),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 18,
                              vertical: 8,
                            ),
                            decoration: BoxDecoration(
                              color: selectedDiner == i + 1
                                  ? AppColors.gold
                                  : AppColors.background,
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: selectedDiner == i + 1
                                    ? AppColors.gold
                                    : AppColors.surfaceElevated,
                              ),
                            ),
                            child: Text(
                              'Comensal ${i + 1}',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w400,
                                color: selectedDiner == i + 1
                                    ? AppColors.background
                                    : AppColors.textSecondary,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),

                // Notas
                const Text(
                  'NOTAS ESPECIALES',
                  style: TextStyle(
                    fontSize: 10,
                    color: AppColors.textMuted,
                    letterSpacing: 2,
                    fontWeight: FontWeight.w400,
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  onChanged: (v) => notes = v,
                  style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 14,
                    fontWeight: FontWeight.w300,
                  ),
                  decoration: InputDecoration(
                    hintText: 'Sin cebolla, extra salsa...',
                    hintStyle: const TextStyle(
                      color: AppColors.textMuted,
                      fontWeight: FontWeight.w300,
                    ),
                    filled: true,
                    fillColor: AppColors.background,
                    contentPadding: const EdgeInsets.all(12),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(
                        color: AppColors.surfaceElevated,
                      ),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(
                        color: AppColors.surfaceElevated,
                      ),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(
                        color: AppColors.gold,
                        width: 1.5,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 22),

                // Botón agregar
                GestureDetector(
                  onTap: () {
                    final nombre = item['name'] as String;
                    order.addItem(
                      OrderItem(
                        id: DateTime.now().millisecondsSinceEpoch.toString(),
                        productId: item['id'] as int?,
                        name: nombre,
                        price: (item['price'] as num).toDouble(),
                        diner: selectedDiner,
                        notes: notes.isNotEmpty ? notes : null,
                      ),
                    );
                    Navigator.pop(context);
                    // ← snackbar con texto siempre visible
                    _showAddedSnack(nombre);
                  },
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [AppColors.gold, AppColors.goldLight],
                      ),
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.gold.withOpacity(0.3),
                          blurRadius: 16,
                          offset: const Offset(0, 6),
                        ),
                      ],
                    ),
                    child: const Text(
                      'AGREGAR A LA ORDEN',
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
              ],
            ),
          ),
        ),
      ),
    );
  }

  // ── Build ─────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    final order = context.watch<OrderProvider>();
    _handleForcedLogout(order);
    if (!order.isAuthenticated && _redirectingToLogin) {
      return const Scaffold(backgroundColor: AppColors.background);
    }
    final categories = _categories(order);
    if (categories.isNotEmpty && !categories.contains(_cat)) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) setState(() => _cat = categories.first);
      });
    }
    final pendingCount = order.pendingToKitchen.length;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(order, context),
            _buildCategoryTabs(order),
            Expanded(
              child: GestureDetector(
                behavior: HitTestBehavior.translucent,
                onHorizontalDragEnd: (details) =>
                    _onHorizontalSwipe(details, order),
                child: _buildList(order),
              ),
            ),
          ],
        ),
      ),
      floatingActionButton: pendingCount > 0
          ? _buildFab(pendingCount, order)
          : null,
    );
  }

  Widget _buildHeader(OrderProvider order, BuildContext context) {
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
                  order.currentTable?.name ?? 'Menú',
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
                if (order.diners > 0)
                  GestureDetector(
                    onTap: () => _showAddGuestsDialog(order),
                    child: Container(
                      margin: const EdgeInsets.only(top: 4),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppColors.surfaceElevated),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.people_outline,
                            size: 12,
                            color: AppColors.textMuted,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            '${order.diners} comensales',
                            style: const TextStyle(
                              fontSize: 11,
                              color: AppColors.textMuted,
                              fontWeight: FontWeight.w300,
                            ),
                          ),
                          const SizedBox(width: 4),
                          const Icon(
                            Icons.add,
                            size: 12,
                            color: AppColors.gold,
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
          if (order.pendingToKitchen.isNotEmpty ||
              order.alreadyInKitchen.isNotEmpty)
            GestureDetector(
              onTap: () => Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const OrderSummaryScreen()),
              ),
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [AppColors.gold, AppColors.goldLight],
                  ),
                  borderRadius: BorderRadius.circular(22),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.gold.withOpacity(0.35),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.receipt_long_outlined,
                      color: AppColors.background,
                      size: 18,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      '${order.pendingToKitchen.length + order.alreadyInKitchen.length} platillo${(order.pendingToKitchen.length + order.alreadyInKitchen.length) != 1 ? 's' : ''}',
                      style: const TextStyle(
                        color: AppColors.background,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
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

  Widget _buildCategoryTabs(OrderProvider order) {
    final categories = _categories(order);
    return SizedBox(
      height: 52,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        itemCount: categories.length,
        itemBuilder: (_, i) {
          final cat = categories[i];
          final active = cat == _cat;
          return GestureDetector(
            onTap: () => _switchCat(cat),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 250),
              margin: const EdgeInsets.only(right: 8),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              decoration: BoxDecoration(
                color: active ? AppColors.gold : AppColors.surface,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: active ? AppColors.gold : AppColors.surfaceElevated,
                ),
                boxShadow: active
                    ? [
                        BoxShadow(
                          color: AppColors.gold.withOpacity(0.25),
                          blurRadius: 10,
                        ),
                      ]
                    : null,
              ),
              child: Text(
                cat,
                style: TextStyle(
                  fontSize: 12,
                  color: active
                      ? AppColors.background
                      : AppColors.textSecondary,
                  fontWeight: active ? FontWeight.w500 : FontWeight.w300,
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildList(OrderProvider order) {
    final items = _items(order);
    if (order.menuItems.isEmpty) {
      return const Center(
        child: Text(
          'Cargando menú...',
          style: TextStyle(
            fontSize: 14,
            color: AppColors.textMuted,
            fontWeight: FontWeight.w300,
          ),
        ),
      );
    }
    if (items.isEmpty) {
      return const Center(
        child: Text(
          'No hay productos en esta categoría',
          style: TextStyle(
            fontSize: 13,
            color: AppColors.textMuted,
            fontWeight: FontWeight.w300,
          ),
        ),
      );
    }
    return FadeTransition(
      opacity: _fadeAnim,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 100),
        itemCount: items.length,
        separatorBuilder: (_, __) => const SizedBox(height: 12),
        itemBuilder: (_, i) {
          final item = items[i];
          return TweenAnimationBuilder<double>(
            key: ValueKey('${item['name']}-$_cat'),
            tween: Tween(begin: 0, end: 1),
            duration: Duration(milliseconds: 250 + i * 60),
            curve: Curves.easeOut,
            builder: (_, v, child) => Opacity(
              opacity: v,
              child: Transform.translate(
                offset: Offset(0, 10 * (1 - v)),
                child: child,
              ),
            ),
            child: GestureDetector(
              onTap: () => _showAddModal(item, order),
              child: Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.surfaceElevated),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.3),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            item['name'],
                            style: const TextStyle(
                              fontSize: 15,
                              color: AppColors.textPrimary,
                              fontWeight: FontWeight.w300,
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            item['desc'],
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppColors.textSecondary,
                              fontWeight: FontWeight.w300,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            '\$${(item['price'] as double).toStringAsFixed(2)}',
                            style: const TextStyle(
                              fontSize: 16,
                              color: AppColors.gold,
                              fontWeight: FontWeight.w400,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: AppColors.gold.withOpacity(0.1),
                        border: Border.all(
                          color: AppColors.gold.withOpacity(0.3),
                        ),
                      ),
                      child: const Icon(
                        Icons.add,
                        color: AppColors.gold,
                        size: 20,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildFab(int count, OrderProvider order) {
    return GestureDetector(
      onTap: () => Navigator.push(
        context,
        PageRouteBuilder(
          pageBuilder: (_, a, __) => const OrderSummaryScreen(),
          transitionDuration: const Duration(milliseconds: 400),
          transitionsBuilder: (_, a, __, child) => SlideTransition(
            position: Tween<Offset>(
              begin: const Offset(1, 0),
              end: Offset.zero,
            ).animate(CurvedAnimation(parent: a, curve: Curves.easeOut)),
            child: child,
          ),
        ),
      ),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [AppColors.gold, AppColors.goldLight],
          ),
          borderRadius: BorderRadius.circular(30),
          boxShadow: [
            BoxShadow(
              color: AppColors.gold.withOpacity(0.4),
              blurRadius: 20,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.receipt_long_outlined,
              color: AppColors.background,
              size: 20,
            ),
            const SizedBox(width: 10),
            Text(
              'Ver Orden ($count) · \$${order.grandTotal.toStringAsFixed(2)}',
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w500,
                color: AppColors.background,
                letterSpacing: 0.5,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
