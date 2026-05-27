import 'package:flutter/material.dart';
import '../core/theme.dart';
import '../models/diary_entry.dart';

// A notebook-style card showing one diary mode (감정/행복/자유).
// User swipes between three of these on the home screen.
class DiaryModeCard extends StatelessWidget {
  final DiaryType type;
  final VoidCallback onTap;

  const DiaryModeCard({super.key, required this.type, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 220,
        margin: const EdgeInsets.symmetric(horizontal: 8),
        child: Column(
          children: [
            // Spiral binding (top of notebook)
            Container(
              height: 24,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: List.generate(
                  9,
                  (_) => Container(
                    width: 4,
                    height: 22,
                    decoration: BoxDecoration(
                      color: const Color(0xFF909090),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
              ),
            ),
            // Notebook page
            Container(
              height: 320,
              padding: const EdgeInsets.fromLTRB(22, 28, 22, 20),
              decoration: BoxDecoration(
                color: type.color,
                borderRadius: const BorderRadius.only(
                  bottomLeft: Radius.circular(20),
                  bottomRight: Radius.circular(20),
                ),
                boxShadow: const [
                  BoxShadow(color: Color(0x26000000), blurRadius: 10, offset: Offset(2, 2)),
                ],
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    type.description,
                    textAlign: TextAlign.left,
                    style: const TextStyle(
                      fontSize: 17,
                      height: 2.0,
                      color: HappilyColors.ink,
                    ),
                  ),
                  Align(
                    alignment: Alignment.bottomRight,
                    child: Icon(type.icon, size: 28, color: HappilyColors.ink),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            Text(
              type.label,
              style: const TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.w300,
                color: HappilyColors.ink,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
