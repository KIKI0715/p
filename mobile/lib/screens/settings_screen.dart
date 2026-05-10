import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/auth_provider.dart';
import 'login_screen.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  final _devtoKeyCtrl = TextEditingController();
  bool _obscureKey = true;
  bool _saving = false;

  @override
  void dispose() {
    _devtoKeyCtrl.dispose();
    super.dispose();
  }

  Future<void> _saveDevtoKey() async {
    final key = _devtoKeyCtrl.text.trim();
    if (key.isEmpty) return;
    setState(() => _saving = true);
    final ok = await ref.read(authProvider.notifier).updateProfile(devtoApiKey: key);
    if (mounted) {
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(ok ? 'Dev.to API key saved' : 'Failed to save key')),
      );
      if (ok) _devtoKeyCtrl.clear();
    }
  }

  Future<void> _logout() async {
    await ref.read(authProvider.notifier).logout();
    if (mounted) {
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
        (_) => false,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    final user = auth.user;

    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Profile', style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 8),
                  if (user != null) ...[
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: const Icon(Icons.person_outlined),
                      title: Text(user.name),
                      subtitle: Text(user.email),
                    ),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text('Dev.to API Key', style: Theme.of(context).textTheme.titleMedium),
                      const SizedBox(width: 8),
                      if (user?.hasDevtoKey == true)
                        const Chip(
                          label: Text('Configured', style: TextStyle(fontSize: 11)),
                          avatar: Icon(Icons.check, size: 14, color: Colors.green),
                          visualDensity: VisualDensity.compact,
                        ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Required to publish articles to Dev.to. Get your key at dev.to/settings/extensions.',
                    style: TextStyle(color: Colors.grey, fontSize: 12),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _devtoKeyCtrl,
                    obscureText: _obscureKey,
                    decoration: InputDecoration(
                      labelText: user?.hasDevtoKey == true ? 'Update key' : 'Paste API key',
                      border: const OutlineInputBorder(),
                      suffixIcon: IconButton(
                        icon: Icon(_obscureKey ? Icons.visibility : Icons.visibility_off),
                        onPressed: () => setState(() => _obscureKey = !_obscureKey),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: _saving ? null : _saveDevtoKey,
                      child: Text(_saving ? 'Saving…' : 'Save API Key'),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 32),
          OutlinedButton.icon(
            onPressed: _logout,
            icon: const Icon(Icons.logout),
            label: const Text('Sign Out'),
            style: OutlinedButton.styleFrom(foregroundColor: Colors.red),
          ),
        ],
      ),
    );
  }
}
