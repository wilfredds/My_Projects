import 'package:cyclemind_ai/features/bike_doctor/presentation/screens/bike_doctor_screen.dart';
import 'package:cyclemind_ai/features/bikes/presentation/screens/bikes_screen.dart';
import 'package:cyclemind_ai/features/dashboard/presentation/screens/dashboard_screen.dart';
import 'package:cyclemind_ai/features/profile/presentation/screens/profile_screen.dart';
import 'package:flutter/material.dart';

/// The signed-in app shell: a Material 3 [NavigationBar] over an [IndexedStack]
/// so each tab keeps its scroll position and state while switching.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  static const _tabs = [
    DashboardScreen(),
    BikeDoctorScreen(),
    BikesScreen(),
    ProfileScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _index, children: _tabs),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: const [
          NavigationDestination(
              icon: Icon(Icons.dashboard_outlined),
              selectedIcon: Icon(Icons.dashboard),
              label: 'Home'),
          NavigationDestination(
              icon: Icon(Icons.medical_services_outlined),
              selectedIcon: Icon(Icons.medical_services),
              label: 'Doctor'),
          NavigationDestination(
              icon: Icon(Icons.pedal_bike_outlined),
              selectedIcon: Icon(Icons.pedal_bike),
              label: 'Bikes'),
          NavigationDestination(
              icon: Icon(Icons.person_outline),
              selectedIcon: Icon(Icons.person),
              label: 'Profile'),
        ],
      ),
    );
  }
}
