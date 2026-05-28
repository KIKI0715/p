import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/theme.dart';
import '../providers/auth_provider.dart';
import 'login_screen.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    final user = auth.user;

    return Scaffold(
      appBar: AppBar(title: const Text('프로필'), automaticallyImplyLeading: false),
      body: user == null
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              children: [
                const SizedBox(height: 16),
                // Avatar
                Center(
                  child: Container(
                    width: 80,
                    height: 80,
                    decoration: BoxDecoration(
                      color: HappilyColors.primary,
                      shape: BoxShape.circle,
                    ),
                    child: Center(
                      child: Text(
                        user.name.isNotEmpty ? user.name[0].toUpperCase() : '?',
                        style: const TextStyle(fontSize: 32, color: Colors.white, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Center(
                  child: Text(
                    user.name,
                    style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w600, color: HappilyColors.ink),
                  ),
                ),
                Center(
                  child: Text(
                    user.email,
                    style: const TextStyle(fontSize: 13, color: HappilyColors.muted),
                  ),
                ),
                const SizedBox(height: 32),
                _SectionCard(
                  children: [
                    _Tile(
                      icon: Icons.notifications_none,
                      label: '알림 설정',
                      trailing: const Icon(Icons.chevron_right, color: HappilyColors.muted, size: 20),
                      onTap: () => ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('준비 중이에요')),
                      ),
                    ),
                    _Tile(
                      icon: Icons.lock_outline,
                      label: '비밀번호 변경',
                      trailing: const Icon(Icons.chevron_right, color: HappilyColors.muted, size: 20),
                      onTap: () => ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('준비 중이에요')),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                _SectionCard(
                  children: [
                    _Tile(
                      icon: Icons.info_outline,
                      label: '앱 버전',
                      trailing: const Text('1.0.0', style: TextStyle(color: HappilyColors.muted, fontSize: 13)),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                _SectionCard(
                  children: [
                    _Tile(
                      icon: Icons.logout,
                      label: '로그아웃',
                      textColor: HappilyColors.danger,
                      onTap: () async {
                        final ok = await showDialog<bool>(
                          context: context,
                          builder: (ctx) => AlertDialog(
                            title: const Text('로그아웃'),
                            content: const Text('로그아웃 할까요?'),
                            actions: [
                              TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('취소')),
                              TextButton(
                                onPressed: () => Navigator.pop(ctx, true),
                                child: const Text('로그아웃', style: TextStyle(color: HappilyColors.danger)),
                              ),
                            ],
                          ),
                        );
                        if (ok != true) return;
                        await ref.read(authProvider.notifier).logout();
                        if (context.mounted) {
                          Navigator.of(context).pushAndRemoveUntil(
                            MaterialPageRoute(builder: (_) => const LoginScreen()),
                            (_) => false,
                          );
                        }
                      },
                    ),
                  ],
                ),
              ],
            ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  final List<Widget> children;
  const _SectionCard({required this.children});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: HappilyColors.card,
        borderRadius: BorderRadius.circular(14),
        boxShadow: const [BoxShadow(color: Color(0x0D000000), blurRadius: 6, offset: Offset(0, 1))],
      ),
      child: Column(
        children: children
            .asMap()
            .entries
            .map(
              (e) => Column(
                children: [
                  e.value,
                  if (e.key < children.length - 1)
                    const Divider(height: 1, indent: 52),
                ],
              ),
            )
            .toList(),
      ),
    );
  }
}

class _Tile extends StatelessWidget {
  final IconData icon;
  final String label;
  final Widget? trailing;
  final VoidCallback? onTap;
  final Color? textColor;

  const _Tile({required this.icon, required this.label, this.trailing, this.onTap, this.textColor});

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon, color: textColor ?? HappilyColors.ink, size: 20),
      title: Text(label, style: TextStyle(fontSize: 15, color: textColor ?? HappilyColors.ink)),
      trailing: trailing,
      onTap: onTap,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16),
    );
  }
}
