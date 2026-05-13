// lib/models/models.dart

// Quitado pedidoCuenta — ya no se usa
enum TableStatus { libre, ocupado, limpiando }

enum PaymentMethod { efectivo, tarjeta }

enum ChargeMode { total, equitativo, porPersona }

class BoardTable {
  final String id;
  final String name;
  final int? backendId;
  final int? tableNumber;
  TableStatus status;
  int guests;
  double tipAmount;
  List<OrderItem> orders;

  BoardTable({
    required this.id,
    required this.name,
    this.backendId,
    this.tableNumber,
    this.status = TableStatus.libre,
    this.guests = 0,
    this.tipAmount = 0,
    List<OrderItem>? orders,
  }) : orders = orders ?? [];

  bool get hasActiveOrder => orders.any((o) => o.isSentToKitchen);
  bool get hasPending => orders.any((o) => !o.isSentToKitchen);
}

class OrderItem {
  final String id;
  final int? productId;
  final String name;
  final double price;
  final int diner;
  final String? notes;
  bool isSentToKitchen;

  OrderItem({
    required this.id,
    this.productId,
    required this.name,
    required this.price,
    this.diner = 1,
    this.notes,
    this.isSentToKitchen = false,
  });
}

class PaymentRecord {
  final int? diner;
  final PaymentMethod method;
  final double amount;
  final double tipAmount;
  final PaymentMethod? tipMethod;

  const PaymentRecord({
    required this.diner,
    required this.method,
    required this.amount,
    this.tipAmount = 0,
    this.tipMethod,
  });
}

class TicketItem {
  final String name;
  final double price;
  final int? diner;

  const TicketItem({
    required this.name,
    required this.price,
    this.diner,
  });
}

class TicketPayment {
  final PaymentMethod method;
  final double amount;
  final double netAmount;

  const TicketPayment({
    required this.method,
    required this.amount,
    required this.netAmount,
  });
}

class ClosedTicket {
  final int folio;
  final String tableName;
  final String waiterName;
  final DateTime? closedAt;
  final List<TicketItem> items;
  final List<TicketPayment> payments;

  const ClosedTicket({
    required this.folio,
    required this.tableName,
    required this.waiterName,
    required this.closedAt,
    required this.items,
    required this.payments,
  });

  double get subtotal => items.fold(0, (sum, item) => sum + item.price);
}
