import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:walleca/main.dart';

void main() {
  testWidgets('App has title', (WidgetTester tester) async {
    await tester.pumpWidget(const WallecaApp());
    expect(find.text('Walleca'), findsOneWidget);
  });
}
