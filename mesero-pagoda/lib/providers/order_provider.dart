import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import '../models/models.dart';

class OrderProvider extends ChangeNotifier {
  static const String _apiBaseUrl = String.fromEnvironment(
    'PAGODA_API_URL',
    defaultValue: 'http://localhost:8080',
  );

  BoardTable? _currentTable;
  List<BoardTable> _tables = _defaultTables();
  final List<Map<String, dynamic>> _menuItems = [];
  final List<String> _menuCategories = [];

  String? _token;
  int? _usuarioId;
  String? _usuarioNombre;
  bool _isLoading = false;

  double _cardCommissionPercent = 3.5;
  final Map<String, int> _metodoPagoIds = {};
  final Map<String, int> _tipoCobroIds = {};
  int? _estadoItemEnviadoId;

  BoardTable? get currentTable => _currentTable;
  List<BoardTable> get tables => _tables;
  int get diners => _currentTable?.guests ?? 0;
  bool get isLoading => _isLoading;
  bool get isAuthenticated => _token != null && _usuarioId != null;
  String get waiterName => _usuarioNombre ?? 'Mesero';
  List<Map<String, dynamic>> get menuItems => _menuItems;
  List<String> get menuCategories => _menuCategories;

  List<OrderItem> get pendingToKitchen =>
      _currentTable?.orders.where((i) => !i.isSentToKitchen).toList() ?? [];

  List<OrderItem> get alreadyInKitchen =>
      _currentTable?.orders.where((i) => i.isSentToKitchen).toList() ?? [];

  List<OrderItem> get allItems => _currentTable?.orders ?? [];

  double get grandTotal =>
      _currentTable?.orders.fold(0.0, (sum, item) => sum! + item.price) ?? 0.0;

  double get totalPerDiner => diners > 0 ? grandTotal / diners : grandTotal;

  Future<void> loginMesero(String pin) async {
    final normalizedPin = pin.trim();
    if (normalizedPin.isEmpty) {
      throw Exception('PIN requerido.');
    }
    if (!RegExp(r'^\d{6}$').hasMatch(normalizedPin)) {
      throw Exception('El PIN debe tener exactamente 6 dígitos.');
    }
    _setLoading(true);
    try {
      final data = await _postApiData('/api/mesero/login', {'pin': normalizedPin});
      _token = (data['token'] ?? '').toString();
      _usuarioId = (data['usuarioId'] as num?)?.toInt();
      _usuarioNombre = data['nombre']?.toString();
      if (_token == null || _token!.isEmpty || _usuarioId == null) {
        throw Exception('Respuesta de login inválida.');
      }
      await refreshInitialData();
    } finally {
      _setLoading(false);
    }
  }

  void logout() {
    _token = null;
    _usuarioId = null;
    _usuarioNombre = null;
    _currentTable = null;
    _menuItems.clear();
    _menuCategories.clear();
    _tables = _defaultTables();
    _metodoPagoIds.clear();
    _tipoCobroIds.clear();
    _estadoItemEnviadoId = null;
    notifyListeners();
  }

  Future<void> refreshInitialData() async {
    await Future.wait([
      refreshCatalogCaches(),
      refreshTables(),
      refreshMenu(),
      refreshCommission(),
    ]);
  }

  Future<void> refreshMenu() async {
    _ensureAuthenticated();
    final categoriesRaw = await _getApiList('/api/categorias');
    final productsRaw = await _getApiList('/api/productos');

    final categoryById = <int, String>{};
    final orderedCategories = <String>[];
    for (final c in categoriesRaw) {
      final id = (c['id'] as num?)?.toInt();
      final name = c['nombre']?.toString();
      if (id == null || name == null || name.trim().isEmpty) continue;
      categoryById[id] = name;
      orderedCategories.add(name);
    }

    final built = <Map<String, dynamic>>[];
    for (final p in productsRaw) {
      final isActive = p['activo'] == true;
      if (!isActive) continue;
      final id = (p['id'] as num?)?.toInt();
      final priceNum = p['precio'] as num?;
      final name = p['nombre']?.toString();
      final category = p['categoria'] as Map<String, dynamic>?;
      final categoryId = (category?['id'] as num?)?.toInt();
      final categoryName = category?['nombre']?.toString() ??
          (categoryId != null ? categoryById[categoryId] : null);
      if (id == null ||
          priceNum == null ||
          name == null ||
          name.trim().isEmpty ||
          categoryName == null ||
          categoryName.trim().isEmpty) {
        continue;
      }
      built.add({
        'id': id,
        'name': name,
        'price': priceNum.toDouble(),
        'category': categoryName,
        'desc': (p['descripcion'] ?? '').toString(),
      });
    }

    final categoriesWithProducts = <String>{};
    for (final item in built) {
      categoriesWithProducts.add(item['category'].toString());
    }

    _menuItems
      ..clear()
      ..addAll(built);
    _menuCategories
      ..clear()
      ..addAll(orderedCategories.where(categoriesWithProducts.contains));
    if (_menuCategories.isEmpty) {
      _menuCategories.addAll(categoriesWithProducts.toList()..sort());
    }
    notifyListeners();
  }

  Future<void> refreshTables() async {
    _ensureAuthenticated();
    final mesasRaw = await _getApiList('/api/mesas');
    final prevByBackend = <int, BoardTable>{
      for (final t in _tables)
        if (t.backendId != null) t.backendId!: t,
    };

    final loaded = <BoardTable>[];
    for (final mesa in mesasRaw) {
      final id = (mesa['id'] as num?)?.toInt();
      final number = (mesa['numero'] as num?)?.toInt();
      if (id == null || number == null) continue;

      final prev = prevByBackend[id];
      final serverStatus = _mapMesaStatus(
        (mesa['estado'] as Map<String, dynamic>?)?['nombre']?.toString(),
      );
      loaded.add(
        BoardTable(
          id: number.toString(),
          name: 'Mesa $number',
          backendId: id,
          tableNumber: number,
          status: prev?.orders.isNotEmpty == true ? prev!.status : serverStatus,
          guests: prev?.guests ?? 0,
          tipAmount: prev?.tipAmount ?? 0,
          orders: prev?.orders ?? [],
        ),
      );
    }

    loaded.sort((a, b) => (a.tableNumber ?? 0).compareTo(b.tableNumber ?? 0));
    if (loaded.isNotEmpty) {
      _tables = loaded;
    }
    notifyListeners();
  }

  Future<void> refreshCatalogCaches() async {
    _ensureAuthenticated();
    final metodos = await _getApiList('/api/catalogos/metodos-pago');
    final tiposCobro = await _getApiList('/api/catalogos/tipos-cobro');
    final estadosItem = await _getApiList('/api/catalogos/estados-item');

    _metodoPagoIds
      ..clear()
      ..addEntries(metodos
          .where((m) => m['id'] != null && m['nombre'] != null)
          .map((m) => MapEntry(
                m['nombre'].toString().toUpperCase(),
                (m['id'] as num).toInt(),
              )));

    _tipoCobroIds
      ..clear()
      ..addEntries(tiposCobro
          .where((t) => t['id'] != null && t['nombre'] != null)
          .map((t) => MapEntry(
                t['nombre'].toString().toUpperCase(),
                (t['id'] as num).toInt(),
              )));

    for (final estado in estadosItem) {
      final nombre = estado['nombre']?.toString().toUpperCase();
      final id = (estado['id'] as num?)?.toInt();
      if (nombre == 'ENVIADO' && id != null) {
        _estadoItemEnviadoId = id;
        break;
      }
    }
  }

  Future<void> refreshCommission() async {
    _ensureAuthenticated();
    try {
      final params = await _getApiData('/api/operacion/parametros');
      if (params is! Map<String, dynamic>) return;
      final commission = (params['comisionBancaria'] as num?)?.toDouble();
      if (commission != null && commission >= 0) {
        _cardCommissionPercent = commission;
      }
    } catch (_) {
      _cardCommissionPercent = 3.5;
    }
  }

  Future<void> registrarVenta({
    required ChargeMode mode,
    required List<PaymentRecord> payments,
    required double totalCuenta,
  }) async {
    _ensureAuthenticated();
    final table = _currentTable;
    if (table == null || table.backendId == null) {
      throw Exception('No hay mesa activa para registrar la venta.');
    }
    if (_usuarioId == null) {
      throw Exception('No hay sesión de mesero activa.');
    }
    if (payments.isEmpty) {
      throw Exception('No hay pagos para registrar.');
    }
    if (_estadoItemEnviadoId == null ||
        _metodoPagoIds.isEmpty ||
        _tipoCobroIds.isEmpty) {
      await refreshCatalogCaches();
    }

    final tipoCobroNombre = switch (mode) {
      ChargeMode.total => 'TOTAL',
      ChargeMode.equitativo => 'EQUITATIVO',
      ChargeMode.porPersona => 'POR_PERSONA',
    };
    final tipoCobroId = _tipoCobroIds[tipoCobroNombre];
    if (tipoCobroId == null) {
      throw Exception(
          'No se encontró el tipo de cobro $tipoCobroNombre en catálogo.');
    }

    final venta = await _postApiData('/api/ventas/abrir', {
      'mesa': {'id': table.backendId},
      'usuario': {'id': _usuarioId},
      'numComensales': table.guests,
      'tipoCobro': {'id': tipoCobroId},
      'totalCuenta': _round2(totalCuenta),
    });
    final ventaId = (venta['id'] as num?)?.toInt();
    if (ventaId == null) {
      throw Exception('No se pudo obtener el ID de la venta creada.');
    }

    for (final item in table.orders) {
      if (item.productId == null) {
        throw Exception('Producto sin ID de API en la orden: ${item.name}.');
      }
      await _postApiData('/api/ventas/items', {
        'venta': {'id': ventaId},
        'producto': {'id': item.productId},
        'numeroComensal': item.diner,
        'precioUnitario': _round2(item.price),
        'cantidad': 1,
        'notas': item.notes,
        'estadoItem': {'id': _estadoItemEnviadoId},
      });
    }

    for (final payment in payments) {
      final methodName =
          payment.method == PaymentMethod.tarjeta ? 'TARJETA' : 'EFECTIVO';
      final methodId = _metodoPagoIds[methodName];
      if (methodId == null) {
        throw Exception(
            'No se encontró método de pago $methodName en catálogo.');
      }

      final commission = payment.method == PaymentMethod.tarjeta
          ? _cardCommissionPercent
          : 0.0;
      final net = _round2(payment.amount * (1 - (commission / 100)));
      final tipAmount =
          payment.tipAmount <= 0 ? 0.0 : _round2(payment.tipAmount);
      final tipMethod = payment.tipMethod;
      final tipMethodName = tipMethod == null
          ? null
          : (tipMethod == PaymentMethod.tarjeta ? 'TARJETA' : 'EFECTIVO');
      final tipMethodId =
          tipMethodName == null ? null : _metodoPagoIds[tipMethodName];
      final tipCommission =
          tipMethod == PaymentMethod.tarjeta ? _cardCommissionPercent : 0.0;
      final tipNet = tipAmount <= 0
          ? 0.0
          : _round2(tipAmount * (1 - (tipCommission / 100)));

      await _postApiData('/api/ventas/pagos', {
        'venta': {'id': ventaId},
        'numeroComensal': payment.diner,
        'metodoPago': {'id': methodId},
        'monto': _round2(payment.amount),
        'comisionPorcentaje': _round2(commission),
        'montoNeto': net,
        'propinaMonto': tipAmount,
        'propinaMetodoPago': tipMethodId == null ? null : {'id': tipMethodId},
        'propinaNeto': tipNet,
      });
    }

    await _putApiData('/api/ventas/$ventaId/cerrar', {});
  }

  void setCurrentTable(BoardTable table) {
    _currentTable = table;
    notifyListeners();
  }

  void openTable(BoardTable table, int guests) {
    table.guests = guests;
    table.tipAmount = 0;
    table.status = TableStatus.ocupado;
    _currentTable = table;
    notifyListeners();
  }

  void updateGuests(BoardTable table, int guests) {
    table.guests = guests;
    notifyListeners();
  }

  void addItem(OrderItem item) {
    _currentTable?.orders.add(item);
    notifyListeners();
  }

  void removePendingItem(String id) {
    _currentTable?.orders.removeWhere((i) => i.id == id && !i.isSentToKitchen);
    notifyListeners();
  }

  void confirmKitchenRound() {
    for (final item in _currentTable?.orders ?? []) {
      item.isSentToKitchen = true;
    }
    notifyListeners();
  }

  void markTableFree(BoardTable table) {
    table.status = TableStatus.libre;
    table.guests = 0;
    table.tipAmount = 0;
    table.orders.clear();
    notifyListeners();
  }

  void updateTip(BoardTable table, double tipAmount) {
    table.tipAmount = tipAmount < 0 ? 0 : tipAmount;
    notifyListeners();
  }

  void clearOrder() {
    if (_currentTable != null) {
      _currentTable!.orders.clear();
      _currentTable!.guests = 0;
      _currentTable!.status = TableStatus.limpiando;
      _currentTable = null;
      notifyListeners();
    }
  }

  void _setLoading(bool value) {
    _isLoading = value;
    notifyListeners();
  }

  void _ensureAuthenticated() {
    if (_token == null || _token!.isEmpty) {
      throw Exception('Sesión no iniciada.');
    }
  }

  Future<dynamic> _getApiData(String path) async {
    final uri = Uri.parse('$_apiBaseUrl$path');
    final response = await http.get(uri, headers: _headers());
    return _unwrapResponse(response);
  }

  Future<List<Map<String, dynamic>>> _getApiList(String path) async {
    final data = await _getApiData(path);
    if (data is List) {
      return data.whereType<Map<String, dynamic>>().toList();
    }
    throw Exception('Respuesta inválida para $path.');
  }

  Future<Map<String, dynamic>> _postApiData(String path, Object payload) async {
    final uri = Uri.parse('$_apiBaseUrl$path');
    final response = await http.post(
      uri,
      headers: _headers(),
      body: jsonEncode(payload),
    );
    return _unwrapResponse(response);
  }

  Future<Map<String, dynamic>> _putApiData(String path, Object payload) async {
    final uri = Uri.parse('$_apiBaseUrl$path');
    final response = await http.put(
      uri,
      headers: _headers(),
      body: jsonEncode(payload),
    );
    return _unwrapResponse(response);
  }

  Map<String, String> _headers() {
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (_token != null && _token!.isNotEmpty) {
      headers['Authorization'] = 'Bearer $_token';
    }
    return headers;
  }

  dynamic _unwrapResponse(http.Response response) {
    final decoded = jsonDecode(response.body) as Map<String, dynamic>;
    final success = decoded['success'] == true;
    if (!success) {
      final msg = decoded['message']?.toString() ?? 'Error de API';
      throw Exception(msg);
    }
    final data = decoded['data'];
    if (data == null || data is Map<String, dynamic> || data is List) {
      return data;
    }
    throw Exception('Formato de respuesta no soportado.');
  }

  TableStatus _mapMesaStatus(String? raw) {
    final estado = (raw ?? '').toUpperCase();
    if (estado == 'OCUPADO' || estado == 'PIDIENDO_CUENTA') {
      return TableStatus.ocupado;
    }
    if (estado == 'LIMPIANDO') return TableStatus.limpiando;
    return TableStatus.libre;
  }

  static List<BoardTable> _defaultTables() {
    return [
      BoardTable(id: '1', name: 'Mesa 1', backendId: 1, tableNumber: 1),
      BoardTable(id: '2', name: 'Mesa 2', backendId: 2, tableNumber: 2),
      BoardTable(id: '3', name: 'Mesa 3', backendId: 3, tableNumber: 3),
      BoardTable(id: '4', name: 'Mesa 4', backendId: 4, tableNumber: 4),
    ];
  }

  double _round2(double value) => double.parse(value.toStringAsFixed(2));
}
