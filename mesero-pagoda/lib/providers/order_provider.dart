import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../core/api_config.dart';
import '../models/models.dart';

class OrderProvider extends ChangeNotifier {
  static const String _tablesStateKeyPrefix = 'pagoda.tables.state.v1.user.';

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
      final data =
          await _postApiData(ApiConfig.loginMesero, {'pin': normalizedPin});
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
    await _restoreTablesState();
    await Future.wait([
      refreshCatalogCaches(),
      refreshTables(),
      refreshMenu(),
      refreshCommission(),
    ]);
    await _persistTablesState();
  }

  Future<void> refreshMenu() async {
    _ensureAuthenticated();
    final categoriesRaw = await _getApiList(ApiConfig.categorias);
    final productsRaw = await _getApiList(ApiConfig.productos);

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
    final mesasRaw = await _getApiList(ApiConfig.mesas);
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
      final keepLocalState = prev != null &&
          (prev.orders.isNotEmpty ||
              prev.guests > 0 ||
              prev.status != TableStatus.libre);
      loaded.add(
        BoardTable(
          id: number.toString(),
          name: 'Mesa $number',
          backendId: id,
          tableNumber: number,
          status: keepLocalState ? prev!.status : serverStatus,
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

    final currentBackendId = _currentTable?.backendId;
    if (currentBackendId != null) {
      _currentTable = _tableByBackendId(currentBackendId);
    }

    notifyListeners();
    _queuePersistTablesState();
  }

  Future<void> refreshCatalogCaches() async {
    _ensureAuthenticated();
    final metodos = await _getApiList(ApiConfig.metodosPago);
    final tiposCobro = await _getApiList(ApiConfig.tiposCobro);
    final estadosItem = await _getApiList(ApiConfig.estadosItem);

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
      final params = await _getApiData(ApiConfig.parametrosOperacion);
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

    final venta = await _postApiData(ApiConfig.abrirVenta, {
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
      await _postApiData(ApiConfig.crearVentaItem, {
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
      final effectiveTipMethod = payment.tipMethod ?? payment.method;
      final tipMethodName =
          effectiveTipMethod == PaymentMethod.tarjeta ? 'TARJETA' : 'EFECTIVO';
      final tipMethodId = _metodoPagoIds[tipMethodName];
      if (tipMethodId == null) {
        throw Exception(
            'No se encontró método de pago $tipMethodName para la propina.');
      }
      final tipCommission = effectiveTipMethod == PaymentMethod.tarjeta
          ? _cardCommissionPercent
          : 0.0;
      final tipNet = tipAmount <= 0
          ? 0.0
          : _round2(tipAmount * (1 - (tipCommission / 100)));

      await _postApiData(ApiConfig.crearVentaPago, {
        'venta': {'id': ventaId},
        'numeroComensal': payment.diner,
        'metodoPago': {'id': methodId},
        'monto': _round2(payment.amount),
        'comisionPorcentaje': _round2(commission),
        'montoNeto': net,
        'propinaMonto': tipAmount,
        'propinaMetodoPago': {'id': tipMethodId},
        'propinaNeto': tipNet,
      });
    }

    await _putApiData(ApiConfig.cerrarVenta(ventaId), {});
  }

  void setCurrentTable(BoardTable table) {
    _currentTable = table;
    notifyListeners();
    _queuePersistTablesState();
  }

  void openTable(BoardTable table, int guests) {
    table.guests = guests;
    table.tipAmount = 0;
    table.status = TableStatus.ocupado;
    _currentTable = table;
    notifyListeners();
    _queuePersistTablesState();
  }

  void updateGuests(BoardTable table, int guests) {
    table.guests = guests;
    notifyListeners();
    _queuePersistTablesState();
  }

  void addItem(OrderItem item) {
    _currentTable?.orders.add(item);
    notifyListeners();
    _queuePersistTablesState();
  }

  void removePendingItem(String id) {
    _currentTable?.orders.removeWhere((i) => i.id == id && !i.isSentToKitchen);
    notifyListeners();
    _queuePersistTablesState();
  }

  void confirmKitchenRound() {
    for (final item in _currentTable?.orders ?? []) {
      item.isSentToKitchen = true;
    }
    notifyListeners();
    _queuePersistTablesState();
  }

  void markTableFree(BoardTable table) {
    table.status = TableStatus.libre;
    table.guests = 0;
    table.tipAmount = 0;
    table.orders.clear();
    if (_currentTable?.backendId == table.backendId) {
      _currentTable = null;
    }
    notifyListeners();
    _queuePersistTablesState();
  }

  void updateTip(BoardTable table, double tipAmount) {
    table.tipAmount = tipAmount < 0 ? 0 : tipAmount;
    notifyListeners();
    _queuePersistTablesState();
  }

  void clearOrder() {
    if (_currentTable != null) {
      _currentTable!.orders.clear();
      _currentTable!.guests = 0;
      _currentTable!.status = TableStatus.limpiando;
      _currentTable = null;
      notifyListeners();
      _queuePersistTablesState();
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

  Future<dynamic> _getApiData(String endpoint) async {
    final uri = Uri.parse(endpoint);
    final response = await http.get(uri, headers: _headers());
    return _unwrapResponse(response);
  }

  Future<List<Map<String, dynamic>>> _getApiList(String endpoint) async {
    final data = await _getApiData(endpoint);
    if (data is List) {
      return data.whereType<Map<String, dynamic>>().toList();
    }
    throw Exception('Respuesta inválida para $endpoint.');
  }

  Future<Map<String, dynamic>> _postApiData(
      String endpoint, Object payload) async {
    final uri = Uri.parse(endpoint);
    final response = await http.post(
      uri,
      headers: _headers(),
      body: jsonEncode(payload),
    );
    return _unwrapResponse(response);
  }

  Future<Map<String, dynamic>> _putApiData(
      String endpoint, Object payload) async {
    final uri = Uri.parse(endpoint);
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

  String? get _tablesStateKey {
    final userId = _usuarioId;
    if (userId == null) {
      return null;
    }
    return '$_tablesStateKeyPrefix$userId';
  }

  Future<void> _restoreTablesState() async {
    final stateKey = _tablesStateKey;
    if (stateKey == null) {
      return;
    }

    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(stateKey);
    if (raw == null || raw.isEmpty) {
      return;
    }

    dynamic decoded;
    try {
      decoded = jsonDecode(raw);
    } on FormatException {
      await prefs.remove(stateKey);
      return;
    }
    if (decoded is! Map<String, dynamic>) {
      return;
    }

    final tablesData = decoded['tables'];
    if (tablesData is List) {
      final restoredTables = tablesData
          .whereType<Map<String, dynamic>>()
          .map(_tableFromJson)
          .toList();
      if (restoredTables.isNotEmpty) {
        _tables = restoredTables;
      }
    }

    final currentBackendId =
        (decoded['currentTableBackendId'] as num?)?.toInt();
    if (currentBackendId != null) {
      _currentTable = _tableByBackendId(currentBackendId);
    }
  }

  Future<void> _persistTablesState() async {
    final stateKey = _tablesStateKey;
    if (stateKey == null) {
      return;
    }

    final prefs = await SharedPreferences.getInstance();
    final payload = {
      'tables': _tables.map(_tableToJson).toList(),
      'currentTableBackendId': _currentTable?.backendId,
    };
    await prefs.setString(stateKey, jsonEncode(payload));
  }

  void _queuePersistTablesState() {
    unawaited(_persistTablesState().catchError((_) {}));
  }

  BoardTable? _tableByBackendId(int backendId) {
    for (final table in _tables) {
      if (table.backendId == backendId) {
        return table;
      }
    }
    return null;
  }

  Map<String, dynamic> _tableToJson(BoardTable table) {
    return {
      'id': table.id,
      'name': table.name,
      'backendId': table.backendId,
      'tableNumber': table.tableNumber,
      'status': table.status.name,
      'guests': table.guests,
      'tipAmount': table.tipAmount,
      'orders': table.orders.map(_orderItemToJson).toList(),
    };
  }

  BoardTable _tableFromJson(Map<String, dynamic> raw) {
    final statusRaw = raw['status']?.toString() ?? TableStatus.libre.name;
    final status = TableStatus.values.firstWhere(
      (value) => value.name == statusRaw,
      orElse: () => TableStatus.libre,
    );
    final ordersRaw = raw['orders'];
    final orders = ordersRaw is List
        ? ordersRaw
            .whereType<Map<String, dynamic>>()
            .map(_orderItemFromJson)
            .toList()
        : <OrderItem>[];
    return BoardTable(
      id: raw['id']?.toString() ?? '',
      name: raw['name']?.toString() ?? 'Mesa',
      backendId: (raw['backendId'] as num?)?.toInt(),
      tableNumber: (raw['tableNumber'] as num?)?.toInt(),
      status: status,
      guests: (raw['guests'] as num?)?.toInt() ?? 0,
      tipAmount: (raw['tipAmount'] as num?)?.toDouble() ?? 0,
      orders: orders,
    );
  }

  Map<String, dynamic> _orderItemToJson(OrderItem item) {
    return {
      'id': item.id,
      'productId': item.productId,
      'name': item.name,
      'price': item.price,
      'diner': item.diner,
      'notes': item.notes,
      'isSentToKitchen': item.isSentToKitchen,
    };
  }

  OrderItem _orderItemFromJson(Map<String, dynamic> raw) {
    return OrderItem(
      id: raw['id']?.toString() ?? '',
      productId: (raw['productId'] as num?)?.toInt(),
      name: raw['name']?.toString() ?? 'Producto',
      price: (raw['price'] as num?)?.toDouble() ?? 0,
      diner: (raw['diner'] as num?)?.toInt() ?? 1,
      notes: raw['notes']?.toString(),
      isSentToKitchen: raw['isSentToKitchen'] == true,
    );
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
