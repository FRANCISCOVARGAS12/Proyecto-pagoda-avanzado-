import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:la_pagoda_pos/main.dart';

void main() {
  testWidgets('La app abre en pantalla de login', (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(const LaPagodaApp());
    await tester.pumpAndSettle();

    expect(find.text('PAGODA'), findsOneWidget);
    expect(find.text('INGRESAR'), findsOneWidget);
  });
}
