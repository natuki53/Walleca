import 'package:flutter/material.dart';

void main() {
  runApp(const WallecaApp());
}

class WallecaApp extends StatelessWidget {
  const WallecaApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Walleca',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepPurple),
        useMaterial3: true,
      ),
      home: const HomePage(),
    );
  }
}

class HomePage extends StatelessWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Walleca'),
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
      ),
      body: const Center(
        child: Text('サブスク・レシート支出管理'),
      ),
    );
  }
}
