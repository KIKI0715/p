import 'package:flutter/material.dart';
import '../core/theme.dart';
import 'analytics_screen.dart';
import 'home_screen.dart';
import 'profile_screen.dart';

class MainScreen extends StatefulWidget {
  const MainScreen({super.key});

  @override
  State<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen> {
  int _index = 0;

  static const _screens = [
    HomeScreen(),
    AnalyticsScreen(),
    ProfileScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      // Each screen has its own Scaffold + AppBar; this outer Scaffold just
      // provides the bottom nav bar.
      body: IndexedStack(index: _index, children: _screens),
      bottomNavigationBar: _HappilyNavBar(
        currentIndex: _index,
        onTap: (i) => setState(() => _index = i),
      ),
    );
  }
}

class _HappilyNavBar extends StatelessWidget {
  final int currentIndex;
  final ValueChanged<int> onTap;

  const _HappilyNavBar({required this.currentIndex, required this.onTap});

  static const _items = [
    _NavItem(icon: Icons.home_outlined, activeIcon: Icons.home, label: '홈'),
    _NavItem(icon: Icons.bar_chart_outlined, activeIcon: Icons.bar_chart, label: '분석'),
    _NavItem(icon: Icons.person_outline, activeIcon: Icons.person, label: '프로필'),
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 72,
      decoration: const BoxDecoration(
        color: HappilyColors.background,
        border: Border(top: BorderSide(color: Color(0xFFE8E4DC), width: 0.5)),
      ),
      child: Row(
        children: _items.asMap().entries.map((e) {
          final i = e.key;
          final item = e.value;
          final selected = i == currentIndex;
          return Expanded(
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => onTap(i),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    selected ? item.activeIcon : item.icon,
                    size: 22,
                    color: selected ? HappilyColors.ink : HappilyColors.muted,
                  ),
                  const SizedBox(height: 3),
                  Text(
                    item.label,
                    style: TextStyle(
                      fontSize: 11,
                      color: selected ? HappilyColors.ink : HappilyColors.muted,
                      fontWeight: selected ? FontWeight.w700 : FontWeight.w400,
                    ),
                  ),
                ],
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

class _NavItem {
  final IconData icon;
  final IconData activeIcon;
  final String label;
  const _NavItem({required this.icon, required this.activeIcon, required this.label});
}
