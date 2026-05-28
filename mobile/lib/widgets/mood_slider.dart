import 'package:flutter/material.dart';
import '../core/theme.dart';
import '../models/diary_entry.dart';

// "오늘은 어떤 하루였나요?" mood slider — 5 jelly-style faces.
class MoodSlider extends StatelessWidget {
  final Mood? value;
  final ValueChanged<Mood> onChanged;

  const MoodSlider({super.key, required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 14),
      decoration: BoxDecoration(
        color: HappilyColors.card,
        borderRadius: BorderRadius.circular(20),
        boxShadow: const [
          BoxShadow(
            color: Color(0x14000000),
            blurRadius: 10,
            offset: Offset(2, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          const Text(
            '오늘은 어떤 하루였나요?',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w500,
              color: HappilyColors.ink,
            ),
          ),
          const SizedBox(height: 14),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: Mood.values.map((m) {
              final selected = m == value;
              return GestureDetector(
                onTap: () => onChanged(m),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  width: 48,
                  child: Column(
                    children: [
                      Text(
                        m.label,
                        style: TextStyle(
                          fontSize: 11,
                          color: selected ? HappilyColors.ink : HappilyColors.muted,
                          fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
                        ),
                      ),
                      const SizedBox(height: 6),
                      _Jelly(color: m.color, active: selected),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 10),
          // Track + slider thumb position
          _Track(selected: value),
        ],
      ),
    );
  }
}

class _Jelly extends StatelessWidget {
  final Color color;
  final bool active;
  const _Jelly({required this.color, required this.active});

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      width: 36,
      height: 30,
      decoration: BoxDecoration(
        color: color.withOpacity(active ? 1 : 0.45),
        borderRadius: const BorderRadius.only(
          topLeft: Radius.circular(18),
          topRight: Radius.circular(18),
          bottomLeft: Radius.circular(6),
          bottomRight: Radius.circular(6),
        ),
        boxShadow: active
            ? [BoxShadow(color: color.withOpacity(0.4), blurRadius: 8, offset: const Offset(0, 3))]
            : null,
      ),
      child: Stack(
        children: [
          Positioned(
            top: 9,
            left: 8,
            child: Container(width: 5, height: 5, decoration: const BoxDecoration(color: Color(0xFF222222), shape: BoxShape.circle)),
          ),
          Positioned(
            top: 9,
            right: 8,
            child: Container(width: 5, height: 5, decoration: const BoxDecoration(color: Color(0xFF222222), shape: BoxShape.circle)),
          ),
        ],
      ),
    );
  }
}

class _Track extends StatelessWidget {
  final Mood? selected;
  const _Track({required this.selected});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (ctx, c) {
        final width = c.maxWidth;
        final positions = List.generate(5, (i) => (i + 0.5) * (width / 5));
        final thumbX = selected != null ? positions[selected!.index] : width / 2;
        return SizedBox(
          height: 18,
          child: Stack(
            children: [
              Positioned(
                left: 0,
                right: 0,
                top: 8,
                child: Container(height: 2, color: const Color(0xFFE3DFD8)),
              ),
              for (final x in positions)
                Positioned(
                  left: x - 2,
                  top: 3,
                  child: Container(width: 2, height: 12, color: const Color(0xFFE3DFD8)),
                ),
              AnimatedPositioned(
                duration: const Duration(milliseconds: 250),
                curve: Curves.easeOut,
                left: thumbX - 8,
                top: 1,
                child: Container(
                  width: 16,
                  height: 16,
                  decoration: BoxDecoration(
                    color: selected?.color ?? HappilyColors.muted,
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 2),
                    boxShadow: const [BoxShadow(color: Color(0x33000000), blurRadius: 4, offset: Offset(0, 2))],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
