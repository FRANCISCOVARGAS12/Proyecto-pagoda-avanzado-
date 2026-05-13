class ApiConfig {
  const ApiConfig._();

  static const String _configuredBaseUrl = String.fromEnvironment(
    'PAGODA_API_URL',
    defaultValue: 'https://pagoda-api-v1-1.onrender.com',
  );

  static String get baseUrl {
    final raw = _configuredBaseUrl.trim();
    if (raw.endsWith('/')) {
      return raw.substring(0, raw.length - 1);
    }
    return raw;
  }

  static String get loginMesero => '$baseUrl/api/mesero/login';
  static String get categorias => '$baseUrl/api/categorias';
  static String get productos => '$baseUrl/api/productos';
  static String get mesas => '$baseUrl/api/mesas';
  static String get metodosPago => '$baseUrl/api/catalogos/metodos-pago';
  static String get tiposCobro => '$baseUrl/api/catalogos/tipos-cobro';
  static String get estadosItem => '$baseUrl/api/catalogos/estados-item';
  static String get parametrosOperacion => '$baseUrl/api/operacion/parametros';
  static String get jornadaEstado => '$baseUrl/api/jornadas/estado';

  static String get abrirVenta => '$baseUrl/api/ventas/abrir';
  static String get crearVentaItem => '$baseUrl/api/ventas/items';
  static String get crearVentaPago => '$baseUrl/api/ventas/pagos';
  static String cerrarVenta(int ventaId) =>
      '$baseUrl/api/ventas/$ventaId/cerrar';
  static String ventasPorJornada(int jornadaId) =>
      '$baseUrl/api/ventas/jornada/$jornadaId';
  static String itemsPorVenta(int ventaId) =>
      '$baseUrl/api/ventas/items/venta/$ventaId';
  static String pagosPorVenta(int ventaId) =>
      '$baseUrl/api/ventas/pagos/venta/$ventaId';
}
