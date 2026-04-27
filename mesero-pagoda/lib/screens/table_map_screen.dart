// lib/screens/table_map_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../theme/app_theme.dart';
import '../models/models.dart';
import '../providers/order_provider.dart';
import 'menu_screen.dart';
import 'order_summary_screen.dart';
import 'login_screen.dart';

class TableMapScreen extends StatefulWidget {
  const TableMapScreen({super.key});
  @override
  State<TableMapScreen> createState() => _TableMapScreenState();
}

class _TableMapScreenState extends State<TableMapScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _fade;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 600))
      ..forward();
    _fade = CurvedAnimation(parent: _ctrl, curve: Curves.easeOut);
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;
      try {
        await context.read<OrderProvider>().refreshTables();
      } catch (_) {}
    });
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  // ── Solo 3 estados: libre, ocupado, limpiando ─────────────────
  Color _colorFor(TableStatus s) {
    switch (s) {
      case TableStatus.libre:
        return AppColors.libre;
      case TableStatus.ocupado:
        return AppColors.ocupado;
      case TableStatus.limpiando:
        return AppColors.limpiando;
    }
  }

  String _labelFor(TableStatus s) {
    switch (s) {
      case TableStatus.libre:
        return 'Libre';
      case TableStatus.ocupado:
        return 'Ocupado';
      case TableStatus.limpiando:
        return 'Limpiando';
    }
  }

  // ── Navegación ────────────────────────────────────────────────
  void _onTableTap(BuildContext context, BoardTable table) {
    final provider = context.read<OrderProvider>();
    if (table.status == TableStatus.libre) {
      _showOpenDialog(context, table, provider);
    } else if (table.status == TableStatus.ocupado) {
      if (table.hasActiveOrder) {
        _showActiveOptions(context, table, provider);
      } else {
        provider.setCurrentTable(table);
        _goToMenu(context);
      }
    }
  }

  void _goToMenu(BuildContext context) {
    Navigator.of(context).push(PageRouteBuilder(
      pageBuilder: (_, a, __) => const MenuScreen(),
      transitionDuration: const Duration(milliseconds: 400),
      transitionsBuilder: (_, a, __, child) => SlideTransition(
        position: Tween<Offset>(begin: const Offset(1, 0), end: Offset.zero)
            .animate(CurvedAnimation(parent: a, curve: Curves.easeOut)),
        child: child,
      ),
    ));
  }

  void _goToSummary(BuildContext context) {
    Navigator.of(context).push(PageRouteBuilder(
      pageBuilder: (_, a, __) => const OrderSummaryScreen(),
      transitionDuration: const Duration(milliseconds: 400),
      transitionsBuilder: (_, a, __, child) => SlideTransition(
        position: Tween<Offset>(begin: const Offset(1, 0), end: Offset.zero)
            .animate(CurvedAnimation(parent: a, curve: Curves.easeOut)),
        child: child,
      ),
    ));
  }

  // ── Modal: opciones mesa activa ───────────────────────────────
  void _showActiveOptions(
      BuildContext context, BoardTable table, OrderProvider provider) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) => Container(
        padding: const EdgeInsets.fromLTRB(24, 28, 24, 40),
        decoration: const BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(bottom: 24),
              decoration: BoxDecoration(
                  color: AppColors.surfaceElevated,
                  borderRadius: BorderRadius.circular(2))),
          Text(table.name,
              style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w300,
                  color: AppColors.gold,
                  shadows: [
                    Shadow(
                        color: AppColors.gold.withOpacity(0.3), blurRadius: 10)
                  ])),
          const SizedBox(height: 4),
          Text('${table.guests} comensales · orden activa',
              style: const TextStyle(
                  fontSize: 12,
                  color: AppColors.textMuted,
                  fontWeight: FontWeight.w300)),
          const SizedBox(height: 28),

          _OptionTile(
            icon: Icons.add_circle_outline,
            label: 'Agregar más platillos',
            subtitle: 'Añadir una nueva ronda a la orden',
            color: AppColors.gold,
            onTap: () {
              Navigator.pop(context);
              provider.setCurrentTable(table);
              _goToMenu(context);
            },
          ),
          const SizedBox(height: 12),
          _OptionTile(
            icon: Icons.receipt_long_outlined,
            label: 'Ver resumen y cobrar',
            subtitle: 'Revisar la orden completa y proceder al pago',
            color: AppColors.libre,
            onTap: () {
              Navigator.pop(context);
              provider.setCurrentTable(table);
              _goToSummary(context);
            },
          ),
          const SizedBox(height: 12),
          // Cambiar número de comensales desde aquí también
          _OptionTile(
            icon: Icons.people_outline,
            label: 'Cambiar comensales',
            subtitle: 'Ajustar el número de personas en la mesa',
            color: AppColors.textSecondary,
            onTap: () {
              Navigator.pop(context);
              _showChangeGuestsDialog(context, table, provider);
            },
          ),
          if (table.orders.isEmpty) ...[
            const SizedBox(height: 12),
            _OptionTile(
              icon: Icons.highlight_off_outlined,
              label: 'Cerrar mesa sin venta',
              subtitle: 'Liberar mesa cuando no hubo consumo',
              color: AppColors.ocupado,
              onTap: () {
                Navigator.pop(context);
                _confirmCloseWithoutSale(context, table);
              },
            ),
          ],
          const SizedBox(height: 12),
          GestureDetector(
            onTap: () => Navigator.pop(context),
            child: const Padding(
              padding: EdgeInsets.symmetric(vertical: 12),
              child: Text('Cancelar',
                  style: TextStyle(
                      fontSize: 13,
                      color: AppColors.textSecondary,
                      fontWeight: FontWeight.w300)),
            ),
          ),
        ]),
      ),
    );
  }

  // ── Dialog: cambiar número de comensales (mesa ya abierta) ────
  void _showChangeGuestsDialog(
      BuildContext context, BoardTable table, OrderProvider provider) {
    int count = table.guests;
    final TextEditingController manualCtrl =
        TextEditingController(text: '$count');

    showDialog(
      context: context,
      barrierColor: Colors.black.withOpacity(0.8),
      builder: (_) => StatefulBuilder(
        builder: (ctx, setS) {
          void applyManual(String val) {
            final n = int.tryParse(val);
            if (n != null && n >= 1 && n <= 20) {
              setS(() {
                count = n;
                manualCtrl.text = '$n';
              });
            }
          }

          return Dialog(
            backgroundColor: Colors.transparent,
            child: TweenAnimationBuilder<double>(
              tween: Tween(begin: 0.9, end: 1.0),
              duration: const Duration(milliseconds: 200),
              curve: Curves.easeOut,
              builder: (_, scale, child) =>
                  Transform.scale(scale: scale, child: child),
              child: Container(
                padding: const EdgeInsets.all(32),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: AppColors.surfaceElevated),
                  boxShadow: [
                    BoxShadow(
                        color: AppColors.gold.withOpacity(0.15),
                        blurRadius: 40),
                    BoxShadow(
                        color: Colors.black.withOpacity(0.6),
                        blurRadius: 40,
                        offset: const Offset(0, 20)),
                  ],
                ),
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  Text('Cambiar Comensales',
                      style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w300,
                          color: AppColors.gold,
                          letterSpacing: 1,
                          shadows: [
                            Shadow(
                                color: AppColors.gold.withOpacity(0.4),
                                blurRadius: 10)
                          ])),
                  const SizedBox(height: 6),
                  Text(table.name,
                      style: const TextStyle(
                          fontSize: 13,
                          color: AppColors.textSecondary,
                          fontWeight: FontWeight.w300)),
                  const SizedBox(height: 28),
                  const Text('Número de comensales',
                      style: TextStyle(
                          fontSize: 12,
                          color: AppColors.textSecondary,
                          letterSpacing: 1,
                          fontWeight: FontWeight.w300)),
                  const SizedBox(height: 20),
                  Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                    _CircleBtn(
                        icon: Icons.remove,
                        enabled: count > 1,
                        onTap: () => setS(() {
                              count--;
                              manualCtrl.text = '$count';
                            })),
                    const SizedBox(width: 20),
                    // ── Número clickeable para entrada manual ──────
                    GestureDetector(
                      onTap: () async {
                        manualCtrl.selection = TextSelection(
                            baseOffset: 0,
                            extentOffset: manualCtrl.text.length);
                        await showDialog(
                          context: ctx,
                          barrierColor: Colors.black.withOpacity(0.6),
                          builder: (_) => Dialog(
                            backgroundColor: Colors.transparent,
                            child: Container(
                              padding: const EdgeInsets.all(24),
                              decoration: BoxDecoration(
                                  color: AppColors.surface,
                                  borderRadius: BorderRadius.circular(20),
                                  border: Border.all(
                                      color: AppColors.surfaceElevated)),
                              child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    const Text(
                                        'Ingresa el número de comensales',
                                        textAlign: TextAlign.center,
                                        style: TextStyle(
                                            fontSize: 14,
                                            color: AppColors.textSecondary,
                                            fontWeight: FontWeight.w300)),
                                    const SizedBox(height: 16),
                                    TextField(
                                      controller: manualCtrl,
                                      autofocus: true,
                                      keyboardType: TextInputType.number,
                                      textAlign: TextAlign.center,
                                      inputFormatters: [
                                        FilteringTextInputFormatter.digitsOnly
                                      ],
                                      style: const TextStyle(
                                          fontSize: 32,
                                          color: AppColors.gold,
                                          fontWeight: FontWeight.w300),
                                      decoration: InputDecoration(
                                        filled: true,
                                        fillColor: AppColors.background,
                                        hintText: '1 – 20',
                                        hintStyle: const TextStyle(
                                            color: AppColors.textMuted,
                                            fontSize: 18),
                                        contentPadding:
                                            const EdgeInsets.symmetric(
                                                vertical: 16),
                                        border: OutlineInputBorder(
                                            borderRadius:
                                                BorderRadius.circular(12),
                                            borderSide: const BorderSide(
                                                color:
                                                    AppColors.surfaceElevated)),
                                        focusedBorder: OutlineInputBorder(
                                            borderRadius:
                                                BorderRadius.circular(12),
                                            borderSide: const BorderSide(
                                                color: AppColors.gold,
                                                width: 1.5)),
                                      ),
                                      onChanged: (v) {
                                        final n = int.tryParse(v);
                                        if (n != null && n > 20) {
                                          manualCtrl.text = '20';
                                          manualCtrl.selection =
                                              const TextSelection.collapsed(
                                                  offset: 2);
                                        }
                                      },
                                    ),
                                    const SizedBox(height: 6),
                                    const Text('Máximo 20 comensales',
                                        style: TextStyle(
                                            fontSize: 10,
                                            color: AppColors.textMuted,
                                            fontWeight: FontWeight.w300)),
                                    const SizedBox(height: 20),
                                    GestureDetector(
                                      onTap: () {
                                        applyManual(manualCtrl.text);
                                        Navigator.pop(ctx);
                                      },
                                      child: Container(
                                        width: double.infinity,
                                        padding: const EdgeInsets.symmetric(
                                            vertical: 14),
                                        decoration: BoxDecoration(
                                          gradient: const LinearGradient(
                                              colors: [
                                                AppColors.gold,
                                                AppColors.goldLight
                                              ]),
                                          borderRadius:
                                              BorderRadius.circular(12),
                                        ),
                                        child: const Text('ACEPTAR',
                                            textAlign: TextAlign.center,
                                            style: TextStyle(
                                                fontSize: 13,
                                                fontWeight: FontWeight.w500,
                                                letterSpacing: 2,
                                                color: AppColors.background)),
                                      ),
                                    ),
                                  ]),
                            ),
                          ),
                        );
                        setS(() {});
                      },
                      child: Container(
                        width: 110,
                        height: 110,
                        decoration: BoxDecoration(
                          color: AppColors.background,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: AppColors.gold, width: 2),
                          boxShadow: [
                            BoxShadow(
                                color: AppColors.gold.withOpacity(0.2),
                                blurRadius: 24)
                          ],
                        ),
                        child: Stack(alignment: Alignment.center, children: [
                          Text('$count',
                              style: const TextStyle(
                                  fontSize: 52,
                                  fontWeight: FontWeight.w300,
                                  color: AppColors.gold)),
                          // Hint de que es editable
                          Positioned(
                            bottom: 8,
                            child: Text('toca para editar',
                                style: TextStyle(
                                    fontSize: 8,
                                    color: AppColors.textMuted.withOpacity(0.7),
                                    fontWeight: FontWeight.w300)),
                          ),
                        ]),
                      ),
                    ),
                    const SizedBox(width: 20),
                    _CircleBtn(
                        icon: Icons.add,
                        enabled: count < 20,
                        onTap: () => setS(() {
                              count++;
                              manualCtrl.text = '$count';
                            })),
                  ]),
                  const SizedBox(height: 32),
                  GestureDetector(
                    onTap: () {
                      provider.updateGuests(table, count);
                      Navigator.pop(context);
                    },
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                            colors: [AppColors.gold, AppColors.goldLight]),
                        borderRadius: BorderRadius.circular(16),
                        boxShadow: [
                          BoxShadow(
                              color: AppColors.gold.withOpacity(0.3),
                              blurRadius: 20,
                              offset: const Offset(0, 8))
                        ],
                      ),
                      child: const Text('GUARDAR CAMBIOS',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w500,
                              letterSpacing: 2,
                              color: AppColors.background)),
                    ),
                  ),
                  const SizedBox(height: 12),
                  GestureDetector(
                    onTap: () => Navigator.pop(context),
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: AppColors.surfaceElevated)),
                      child: const Text('CANCELAR',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w300,
                              letterSpacing: 2,
                              color: AppColors.textSecondary)),
                    ),
                  ),
                ]),
              ),
            ),
          );
        },
      ),
    );
  }

  // ── Dialog: abrir mesa libre ──────────────────────────────────
  void _showOpenDialog(
      BuildContext context, BoardTable table, OrderProvider provider) {
    int count = 2;
    final TextEditingController manualCtrl = TextEditingController(text: '2');

    showDialog(
      context: context,
      barrierColor: Colors.black.withOpacity(0.8),
      builder: (_) => StatefulBuilder(
        builder: (ctx, setS) {
          void applyManual(String val) {
            final n = int.tryParse(val);
            if (n != null && n >= 1 && n <= 20) {
              setS(() {
                count = n;
                manualCtrl.text = '$n';
              });
            }
          }

          return Dialog(
            backgroundColor: Colors.transparent,
            child: TweenAnimationBuilder<double>(
              tween: Tween(begin: 0.9, end: 1.0),
              duration: const Duration(milliseconds: 200),
              curve: Curves.easeOut,
              builder: (_, scale, child) =>
                  Transform.scale(scale: scale, child: child),
              child: Container(
                padding: const EdgeInsets.all(32),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: AppColors.surfaceElevated),
                  boxShadow: [
                    BoxShadow(
                        color: AppColors.gold.withOpacity(0.15),
                        blurRadius: 40),
                    BoxShadow(
                        color: Colors.black.withOpacity(0.6),
                        blurRadius: 40,
                        offset: const Offset(0, 20)),
                  ],
                ),
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  Text('Abrir Mesa',
                      style: TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w300,
                          color: AppColors.gold,
                          letterSpacing: 1,
                          shadows: [
                            Shadow(
                                color: AppColors.gold.withOpacity(0.4),
                                blurRadius: 10)
                          ])),
                  const SizedBox(height: 6),
                  Text(table.name,
                      style: const TextStyle(
                          fontSize: 13,
                          color: AppColors.textSecondary,
                          fontWeight: FontWeight.w300)),
                  const SizedBox(height: 32),
                  const Text('Número de comensales',
                      style: TextStyle(
                          fontSize: 12,
                          color: AppColors.textSecondary,
                          letterSpacing: 1,
                          fontWeight: FontWeight.w300)),
                  const SizedBox(height: 20),
                  Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                    _CircleBtn(
                        icon: Icons.remove,
                        enabled: count > 1,
                        onTap: () => setS(() {
                              count--;
                              manualCtrl.text = '$count';
                            })),
                    const SizedBox(width: 20),

                    // ── Número clickeable: toca para escribir manualmente ──
                    GestureDetector(
                      onTap: () async {
                        manualCtrl.selection = TextSelection(
                            baseOffset: 0,
                            extentOffset: manualCtrl.text.length);
                        await showDialog(
                          context: ctx,
                          barrierColor: Colors.black.withOpacity(0.6),
                          builder: (_) => Dialog(
                            backgroundColor: Colors.transparent,
                            child: Container(
                              padding: const EdgeInsets.all(24),
                              decoration: BoxDecoration(
                                  color: AppColors.surface,
                                  borderRadius: BorderRadius.circular(20),
                                  border: Border.all(
                                      color: AppColors.surfaceElevated)),
                              child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    const Text(
                                        'Ingresa el número de comensales',
                                        textAlign: TextAlign.center,
                                        style: TextStyle(
                                            fontSize: 14,
                                            color: AppColors.textSecondary,
                                            fontWeight: FontWeight.w300)),
                                    const SizedBox(height: 16),
                                    TextField(
                                      controller: manualCtrl,
                                      autofocus: true,
                                      keyboardType: TextInputType.number,
                                      textAlign: TextAlign.center,
                                      inputFormatters: [
                                        FilteringTextInputFormatter.digitsOnly
                                      ],
                                      style: const TextStyle(
                                          fontSize: 32,
                                          color: AppColors.gold,
                                          fontWeight: FontWeight.w300),
                                      decoration: InputDecoration(
                                        filled: true,
                                        fillColor: AppColors.background,
                                        hintText: '1 – 20',
                                        hintStyle: const TextStyle(
                                            color: AppColors.textMuted,
                                            fontSize: 18),
                                        contentPadding:
                                            const EdgeInsets.symmetric(
                                                vertical: 16),
                                        border: OutlineInputBorder(
                                            borderRadius:
                                                BorderRadius.circular(12),
                                            borderSide: const BorderSide(
                                                color:
                                                    AppColors.surfaceElevated)),
                                        focusedBorder: OutlineInputBorder(
                                            borderRadius:
                                                BorderRadius.circular(12),
                                            borderSide: const BorderSide(
                                                color: AppColors.gold,
                                                width: 1.5)),
                                      ),
                                      onChanged: (v) {
                                        final n = int.tryParse(v);
                                        if (n != null && n > 20) {
                                          manualCtrl.text = '20';
                                          manualCtrl.selection =
                                              const TextSelection.collapsed(
                                                  offset: 2);
                                        }
                                      },
                                    ),
                                    const SizedBox(height: 6),
                                    const Text('Máximo 20 comensales',
                                        style: TextStyle(
                                            fontSize: 10,
                                            color: AppColors.textMuted,
                                            fontWeight: FontWeight.w300)),
                                    const SizedBox(height: 20),
                                    GestureDetector(
                                      onTap: () {
                                        applyManual(manualCtrl.text);
                                        Navigator.pop(ctx);
                                      },
                                      child: Container(
                                        width: double.infinity,
                                        padding: const EdgeInsets.symmetric(
                                            vertical: 14),
                                        decoration: BoxDecoration(
                                          gradient: const LinearGradient(
                                              colors: [
                                                AppColors.gold,
                                                AppColors.goldLight
                                              ]),
                                          borderRadius:
                                              BorderRadius.circular(12),
                                        ),
                                        child: const Text('ACEPTAR',
                                            textAlign: TextAlign.center,
                                            style: TextStyle(
                                                fontSize: 13,
                                                fontWeight: FontWeight.w500,
                                                letterSpacing: 2,
                                                color: AppColors.background)),
                                      ),
                                    ),
                                  ]),
                            ),
                          ),
                        );
                        setS(() {});
                      },
                      child: Container(
                        width: 110,
                        height: 110,
                        decoration: BoxDecoration(
                          color: AppColors.background,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: AppColors.gold, width: 2),
                          boxShadow: [
                            BoxShadow(
                                color: AppColors.gold.withOpacity(0.2),
                                blurRadius: 24)
                          ],
                        ),
                        child: Stack(alignment: Alignment.center, children: [
                          Text('$count',
                              style: const TextStyle(
                                  fontSize: 52,
                                  fontWeight: FontWeight.w300,
                                  color: AppColors.gold)),
                          Positioned(
                            bottom: 8,
                            child: Text('toca para editar',
                                style: TextStyle(
                                    fontSize: 8,
                                    color: AppColors.textMuted.withOpacity(0.7),
                                    fontWeight: FontWeight.w300)),
                          ),
                        ]),
                      ),
                    ),
                    const SizedBox(width: 20),
                    _CircleBtn(
                        icon: Icons.add,
                        enabled: count < 20,
                        onTap: () => setS(() {
                              count++;
                              manualCtrl.text = '$count';
                            })),
                  ]),
                  const SizedBox(height: 36),
                  GestureDetector(
                    onTap: () {
                      provider.openTable(table, count);
                      Navigator.pop(context);
                      _goToMenu(context);
                    },
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                            colors: [AppColors.gold, AppColors.goldLight]),
                        borderRadius: BorderRadius.circular(16),
                        boxShadow: [
                          BoxShadow(
                              color: AppColors.gold.withOpacity(0.3),
                              blurRadius: 20,
                              offset: const Offset(0, 8))
                        ],
                      ),
                      child: const Text('ABRIR MESA',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w500,
                              letterSpacing: 2,
                              color: AppColors.background)),
                    ),
                  ),
                  const SizedBox(height: 12),
                  GestureDetector(
                    onTap: () => Navigator.pop(context),
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: AppColors.surfaceElevated)),
                      child: const Text('CANCELAR',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w300,
                              letterSpacing: 2,
                              color: AppColors.textSecondary)),
                    ),
                  ),
                ]),
              ),
            ),
          );
        },
      ),
    );
  }

  void _confirmCloseWithoutSale(BuildContext context, BoardTable table) {
    showDialog(
      context: context,
      barrierColor: Colors.black.withOpacity(0.8),
      builder: (_) => Dialog(
        backgroundColor: Colors.transparent,
        child: Container(
          padding: const EdgeInsets.all(28),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: AppColors.surfaceElevated),
          ),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Icon(Icons.highlight_off_outlined,
                size: 42, color: AppColors.ocupado.withOpacity(0.9)),
            const SizedBox(height: 12),
            Text(
              'Cerrar sin venta',
              style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w300,
                  color: AppColors.gold,
                  shadows: [
                    Shadow(
                        color: AppColors.gold.withOpacity(0.3), blurRadius: 10)
                  ]),
            ),
            const SizedBox(height: 6),
            Text(table.name,
                style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                    fontWeight: FontWeight.w300)),
            const SizedBox(height: 10),
            const Text(
              'La mesa se cerrará sin registrar venta.',
              textAlign: TextAlign.center,
              style: TextStyle(
                  fontSize: 12,
                  color: AppColors.textMuted,
                  fontWeight: FontWeight.w300),
            ),
            const SizedBox(height: 24),
            GestureDetector(
              onTap: () {
                context.read<OrderProvider>().markTableFree(table);
                Navigator.pop(context);
              },
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 14),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                      colors: [AppColors.libre, Color(0xFF14B8A6)]),
                  borderRadius: BorderRadius.circular(14),
                  boxShadow: [
                    BoxShadow(
                        color: AppColors.libre.withOpacity(0.3),
                        blurRadius: 16,
                        offset: const Offset(0, 6))
                  ],
                ),
                child: const Text('SÍ, CERRAR SIN VENTA',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        letterSpacing: 1.5,
                        color: AppColors.background)),
              ),
            ),
            const SizedBox(height: 10),
            GestureDetector(
              onTap: () => Navigator.pop(context),
              child: const Padding(
                padding: EdgeInsets.symmetric(vertical: 10),
                child: Text('Cancelar',
                    style: TextStyle(
                        fontSize: 13,
                        color: AppColors.textSecondary,
                        fontWeight: FontWeight.w300)),
              ),
            ),
          ]),
        ),
      ),
    );
  }

  // ── Dialog: confirmar "Mesa Lista" ────────────────────────────
  void _confirmMarkFree(BuildContext context, BoardTable table) {
    showDialog(
      context: context,
      barrierColor: Colors.black.withOpacity(0.8),
      builder: (_) => Dialog(
        backgroundColor: Colors.transparent,
        child: Container(
          padding: const EdgeInsets.all(32),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: AppColors.surfaceElevated),
            boxShadow: [
              BoxShadow(
                  color: AppColors.libre.withOpacity(0.15), blurRadius: 40)
            ],
          ),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.libre.withOpacity(0.1),
                  border: Border.all(
                      color: AppColors.libre.withOpacity(0.4), width: 2)),
              child: const Icon(Icons.cleaning_services_outlined,
                  color: AppColors.libre, size: 30),
            ),
            const SizedBox(height: 20),
            const Text('¿Mesa lista?',
                style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w300,
                    color: AppColors.libre,
                    letterSpacing: 1)),
            const SizedBox(height: 10),
            Text(
                'Confirma que ${table.name} ya fue limpiada y está disponible.',
                textAlign: TextAlign.center,
                style: const TextStyle(
                    fontSize: 13,
                    color: AppColors.textSecondary,
                    fontWeight: FontWeight.w300)),
            const SizedBox(height: 28),
            GestureDetector(
              onTap: () {
                context.read<OrderProvider>().markTableFree(table);
                Navigator.pop(context);
              },
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 14),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                      colors: [AppColors.libre, Color(0xFF14B8A6)]),
                  borderRadius: BorderRadius.circular(14),
                  boxShadow: [
                    BoxShadow(
                        color: AppColors.libre.withOpacity(0.3),
                        blurRadius: 16,
                        offset: const Offset(0, 6))
                  ],
                ),
                child: const Text('SÍ, MARCAR COMO LIBRE',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        letterSpacing: 1.5,
                        color: AppColors.background)),
              ),
            ),
            const SizedBox(height: 10),
            GestureDetector(
              onTap: () => Navigator.pop(context),
              child: const Padding(
                padding: EdgeInsets.symmetric(vertical: 10),
                child: Text('Cancelar',
                    style: TextStyle(
                        fontSize: 13,
                        color: AppColors.textSecondary,
                        fontWeight: FontWeight.w300)),
              ),
            ),
          ]),
        ),
      ),
    );
  }

  void _showTipDialog(BuildContext context, BoardTable table) {
    final ctrl = TextEditingController(
      text: table.tipAmount > 0 ? table.tipAmount.toStringAsFixed(2) : '',
    );
    showDialog(
      context: context,
      barrierColor: Colors.black.withOpacity(0.8),
      builder: (_) => Dialog(
        backgroundColor: Colors.transparent,
        child: Container(
          padding: const EdgeInsets.all(28),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: AppColors.surfaceElevated),
          ),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Text(
              'Agregar Propina',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w300,
                color: AppColors.gold,
                letterSpacing: 1,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              table.name,
              style: const TextStyle(
                fontSize: 12,
                color: AppColors.textSecondary,
                fontWeight: FontWeight.w300,
              ),
            ),
            const SizedBox(height: 18),
            TextField(
              controller: ctrl,
              autofocus: true,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp(r'[\d.,]')),
              ],
              style: const TextStyle(
                fontSize: 16,
                color: AppColors.textPrimary,
                fontWeight: FontWeight.w300,
              ),
              decoration: InputDecoration(
                hintText: 'Opcional',
                hintStyle:
                    const TextStyle(color: AppColors.textMuted, fontSize: 13),
                prefixText: '\$  ',
                prefixStyle:
                    const TextStyle(color: AppColors.gold, fontSize: 15),
                filled: true,
                fillColor: AppColors.background,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide:
                      const BorderSide(color: AppColors.gold, width: 1.2),
                ),
              ),
            ),
            const SizedBox(height: 18),
            GestureDetector(
              onTap: () {
                final value =
                    double.tryParse(ctrl.text.replaceAll(',', '.')) ?? 0;
                context
                    .read<OrderProvider>()
                    .updateTip(table, value < 0 ? 0 : value);
                Navigator.pop(context);
              },
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 13),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                      colors: [AppColors.gold, AppColors.goldLight]),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Text(
                  'GUARDAR PROPINA',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 12,
                    color: AppColors.background,
                    fontWeight: FontWeight.w500,
                    letterSpacing: 1.5,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 8),
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
          ]),
        ),
      ),
    );
  }

  // ── Build ─────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    final provider = context.watch<OrderProvider>();
    return Scaffold(
      backgroundColor: AppColors.background,
      body: FadeTransition(
        opacity: _fade,
        child: SafeArea(
            child: Column(children: [
          _buildHeader(context),
          Expanded(child: _buildGrid(context, provider)),
          _buildLegend(),
        ])),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    final order = context.watch<OrderProvider>();
    return Container(
      padding: const EdgeInsets.fromLTRB(24, 20, 24, 20),
      decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: AppColors.border))),
      child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('PAGODA',
              style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w300,
                  letterSpacing: 4,
                  color: AppColors.gold,
                  shadows: [
                    Shadow(
                        color: AppColors.gold.withOpacity(0.3), blurRadius: 10)
                  ])),
          const SizedBox(height: 2),
          Text('Mapa de Mesas · ${order.waiterName}',
              style: TextStyle(
                  fontSize: 12,
                  color: AppColors.textMuted,
                  fontWeight: FontWeight.w300,
                  letterSpacing: 1)),
        ]),
        GestureDetector(
          onTap: () {
            context.read<OrderProvider>().logout();
            Navigator.of(context).pushReplacement(PageRouteBuilder(
              pageBuilder: (_, a, __) => const LoginScreen(),
              transitionDuration: const Duration(milliseconds: 400),
              transitionsBuilder: (_, a, __, child) => FadeTransition(
                  opacity: CurvedAnimation(parent: a, curve: Curves.easeOut),
                  child: child),
            ));
          },
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppColors.surfaceElevated)),
            child: const Text('Salir',
                style: TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                    fontWeight: FontWeight.w300)),
          ),
        ),
      ]),
    );
  }

  Widget _buildGrid(BuildContext context, OrderProvider provider) {
    return GridView.builder(
      padding: const EdgeInsets.all(20),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          crossAxisSpacing: 16,
          mainAxisSpacing: 16,
          childAspectRatio: 0.88),
      itemCount: provider.tables.length,
      itemBuilder: (_, i) {
        final table = provider.tables[i];
        return TweenAnimationBuilder<double>(
          tween: Tween(begin: 0, end: 1),
          duration: Duration(milliseconds: 400 + i * 80),
          curve: Curves.easeOut,
          builder: (_, v, child) => Opacity(
              opacity: v,
              child: Transform.translate(
                  offset: Offset(0, 20 * (1 - v)), child: child)),
          child: _buildCard(context, table),
        );
      },
    );
  }

  Widget _buildCard(BuildContext context, BoardTable table) {
    final color = _colorFor(table.status);
    final label = _labelFor(table.status);
    final isLimpiando = table.status == TableStatus.limpiando;
    final clickable = table.status == TableStatus.libre ||
        table.status == TableStatus.ocupado;

    return GestureDetector(
      onTap: clickable ? () => _onTableTap(context, table) : null,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 300),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: color.withOpacity(0.35)),
          boxShadow: [
            BoxShadow(
                color: Colors.black.withOpacity(0.4),
                blurRadius: 20,
                offset: const Offset(0, 8)),
            BoxShadow(color: color.withOpacity(0.15), blurRadius: 20),
          ],
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          // ── Badge de estado ────────────────────────────────────
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
                color: color.withOpacity(0.15),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: color.withOpacity(0.4))),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              _PulseDot(color: color),
              const SizedBox(width: 6),
              Text(label,
                  style: TextStyle(
                      fontSize: 10,
                      color: color,
                      letterSpacing: 1,
                      fontWeight: FontWeight.w400)),
            ]),
          ),
          const SizedBox(height: 10),
          Text(table.name,
              style: TextStyle(
                  fontSize: 20, fontWeight: FontWeight.w300, color: color)),
          if (table.guests > 0) ...[
            const SizedBox(height: 6),
            Row(children: [
              Icon(Icons.people_outline,
                  size: 14, color: AppColors.textSecondary),
              const SizedBox(width: 4),
              Text(
                  '${table.guests} ${table.guests == 1 ? 'persona' : 'personas'}',
                  style: const TextStyle(
                      fontSize: 11,
                      color: AppColors.textSecondary,
                      fontWeight: FontWeight.w300)),
            ]),
          ],
          if (table.hasActiveOrder) ...[
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                  color: AppColors.gold.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.gold.withOpacity(0.3))),
              child: const Text('orden activa',
                  style: TextStyle(
                      fontSize: 9,
                      color: AppColors.gold,
                      fontWeight: FontWeight.w400,
                      letterSpacing: 0.5)),
            ),
          ],
          if (isLimpiando && table.tipAmount > 0) ...[
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: AppColors.libre.withOpacity(0.12),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.libre.withOpacity(0.35)),
              ),
              child: Text(
                'propina \$${table.tipAmount.toStringAsFixed(2)}',
                style: const TextStyle(
                  fontSize: 9,
                  color: AppColors.libre,
                  fontWeight: FontWeight.w400,
                  letterSpacing: 0.4,
                ),
              ),
            ),
          ],
          const Spacer(),

          // ── Botones de acción ──────────────────────────────────
          if (table.status == TableStatus.ocupado && table.hasActiveOrder)
            Row(children: [
              // Botón + platillos
              Expanded(
                  child: GestureDetector(
                onTap: () {
                  context.read<OrderProvider>().setCurrentTable(table);
                  _goToMenu(context);
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 9),
                  decoration: BoxDecoration(
                      gradient: const LinearGradient(
                          colors: [AppColors.gold, AppColors.goldLight]),
                      borderRadius: BorderRadius.circular(10)),
                  child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.add, size: 14, color: AppColors.background),
                        SizedBox(width: 4),
                        Text('Añadir',
                            style: TextStyle(
                                fontSize: 11,
                                color: AppColors.background,
                                fontWeight: FontWeight.w500)),
                      ]),
                ),
              )),
              const SizedBox(width: 6),
              // Botón ver orden / cobrar
              Expanded(
                  child: GestureDetector(
                onTap: () {
                  context.read<OrderProvider>().setCurrentTable(table);
                  _goToSummary(context);
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 9),
                  decoration: BoxDecoration(
                      color: AppColors.background,
                      borderRadius: BorderRadius.circular(10),
                      border:
                          Border.all(color: AppColors.gold.withOpacity(0.4))),
                  child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.receipt_long_outlined,
                            size: 14, color: AppColors.gold),
                        SizedBox(width: 4),
                        Text('Orden',
                            style: TextStyle(
                                fontSize: 11,
                                color: AppColors.gold,
                                fontWeight: FontWeight.w400)),
                      ]),
                ),
              )),
            ])

          // ── Botón Mesa Lista con confirmación ──────────────────
          else if (isLimpiando)
            Row(children: [
              Expanded(
                child: GestureDetector(
                  onTap: () => _showTipDialog(context, table),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 9),
                    decoration: BoxDecoration(
                      color: AppColors.background,
                      borderRadius: BorderRadius.circular(10),
                      border:
                          Border.all(color: AppColors.gold.withOpacity(0.35)),
                    ),
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.attach_money,
                            size: 14, color: AppColors.gold),
                        SizedBox(width: 4),
                        Text(
                          'Propina',
                          style: TextStyle(
                            fontSize: 11,
                            color: AppColors.gold,
                            fontWeight: FontWeight.w400,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: GestureDetector(
                  onTap: () => _confirmMarkFree(context, table),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 9),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                          colors: [AppColors.libre, Color(0xFF14B8A6)]),
                      borderRadius: BorderRadius.circular(10),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.libre.withOpacity(0.25),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.check_circle_outline,
                            size: 14, color: AppColors.background),
                        SizedBox(width: 6),
                        Text(
                          'Mesa Lista',
                          style: TextStyle(
                            fontSize: 11,
                            color: AppColors.background,
                            fontWeight: FontWeight.w500,
                            letterSpacing: 0.3,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ]),
        ]),
      ),
    );
  }

  Widget _buildLegend() {
    // Solo 3 estados ahora
    final items = [
      TableStatus.libre,
      TableStatus.ocupado,
      TableStatus.limpiando
    ];
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 24),
      decoration: const BoxDecoration(
          border: Border(top: BorderSide(color: AppColors.border))),
      child: Wrap(
        alignment: WrapAlignment.center,
        spacing: 20,
        runSpacing: 8,
        children: items
            .map((s) => Row(mainAxisSize: MainAxisSize.min, children: [
                  Container(
                      width: 10,
                      height: 10,
                      decoration: BoxDecoration(
                          shape: BoxShape.circle, color: _colorFor(s))),
                  const SizedBox(width: 6),
                  Text(_labelFor(s),
                      style: const TextStyle(
                          fontSize: 11,
                          color: AppColors.textSecondary,
                          fontWeight: FontWeight.w300)),
                ]))
            .toList(),
      ),
    );
  }
}

// ── Widgets internos ──────────────────────────────────────────

class _OptionTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String subtitle;
  final Color color;
  final VoidCallback onTap;
  const _OptionTile(
      {required this.icon,
      required this.label,
      required this.subtitle,
      required this.color,
      required this.onTap});

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
              color: AppColors.background,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: color.withOpacity(0.3))),
          child: Row(children: [
            Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: color.withOpacity(0.1),
                    border: Border.all(color: color.withOpacity(0.3))),
                child: Icon(icon, color: color, size: 20)),
            const SizedBox(width: 14),
            Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                  Text(label,
                      style: TextStyle(
                          fontSize: 14,
                          color: color,
                          fontWeight: FontWeight.w400)),
                  const SizedBox(height: 2),
                  Text(subtitle,
                      style: const TextStyle(
                          fontSize: 11,
                          color: AppColors.textMuted,
                          fontWeight: FontWeight.w300)),
                ])),
            Icon(Icons.chevron_right, color: color.withOpacity(0.5), size: 20),
          ]),
        ),
      );
}

class _CircleBtn extends StatelessWidget {
  final IconData icon;
  final bool enabled;
  final VoidCallback onTap;
  const _CircleBtn(
      {required this.icon, required this.enabled, required this.onTap});

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: enabled ? onTap : null,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          width: 52,
          height: 52,
          decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: enabled ? AppColors.surfaceElevated : AppColors.surface),
          child: Icon(icon,
              size: 22,
              color: enabled ? AppColors.gold : AppColors.textDisabled),
        ),
      );
}

class _PulseDot extends StatefulWidget {
  final Color color;
  const _PulseDot({required this.color});
  @override
  State<_PulseDot> createState() => _PulseDotState();
}

class _PulseDotState extends State<_PulseDot>
    with SingleTickerProviderStateMixin {
  late AnimationController _c;
  late Animation<double> _a;
  @override
  void initState() {
    super.initState();
    _c = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 1200))
      ..repeat(reverse: true);
    _a = Tween(begin: 0.4, end: 1.0).animate(_c);
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => FadeTransition(
      opacity: _a,
      child: Container(
          width: 6,
          height: 6,
          decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: widget.color,
              boxShadow: [
                BoxShadow(color: widget.color.withOpacity(0.8), blurRadius: 6)
              ])));
}
