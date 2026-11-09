import 'dart:typed_data';

import 'package:cyclemind_ai/app/theme/app_colors.dart';
import 'package:cyclemind_ai/core/constants/app_constants.dart';
import 'package:cyclemind_ai/features/bike_doctor/presentation/controllers/bike_doctor_controller.dart';
import 'package:cyclemind_ai/features/bike_doctor/presentation/widgets/report_card.dart';
import 'package:cyclemind_ai/services/vision/vision_service.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

/// AI Bike Doctor: upload/capture a photo of a bike area, run vision analysis,
/// and view the resulting health report.
class BikeDoctorScreen extends ConsumerStatefulWidget {
  const BikeDoctorScreen({super.key});

  @override
  ConsumerState<BikeDoctorScreen> createState() => _BikeDoctorScreenState();
}

class _BikeDoctorScreenState extends ConsumerState<BikeDoctorScreen> {
  BikePart _part = BikePart.whole;
  Uint8List? _imageBytes;

  Future<void> _pick(ImageSource source) async {
    final picked = await ImagePicker().pickImage(source: source, maxWidth: 1280);
    if (picked == null) return;
    final bytes = await picked.readAsBytes();
    setState(() => _imageBytes = bytes);
  }

  Future<void> _analyze() async {
    await ref.read(bikeDoctorControllerProvider.notifier).analyze(
          // In mock mode an empty list still yields a deterministic demo report.
          imageBytes: _imageBytes ?? Uint8List(0),
          part: _part,
        );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(bikeDoctorControllerProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Bike Doctor'),
        actions: [
          IconButton(
            tooltip: 'Mechanic chat',
            icon: const Icon(Icons.chat_bubble_outline),
            onPressed: () => context.push('/chat'),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Scan a bike area',
                      style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    children: BikePart.values.map((p) {
                      return ChoiceChip(
                        label: Text(p.label),
                        selected: _part == p,
                        onSelected: (_) => setState(() => _part = p),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 16),
                  AspectRatio(
                    aspectRatio: 16 / 10,
                    child: Container(
                      decoration: BoxDecoration(
                        color: Theme.of(context)
                            .colorScheme
                            .surfaceContainerHighest,
                        borderRadius: BorderRadius.circular(16),
                        image: _imageBytes != null
                            ? DecorationImage(
                                image: MemoryImage(_imageBytes!),
                                fit: BoxFit.cover)
                            : null,
                      ),
                      child: _imageBytes == null
                          ? const Center(
                              child: Icon(Icons.add_a_photo_outlined,
                                  size: 40, color: Colors.grey))
                          : null,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () => _pick(ImageSource.camera),
                          icon: const Icon(Icons.camera_alt_outlined),
                          label: const Text('Camera'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () => _pick(ImageSource.gallery),
                          icon: const Icon(Icons.photo_library_outlined),
                          label: const Text('Gallery'),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  FilledButton.icon(
                    onPressed: state.isLoading ? null : _analyze,
                    icon: state.isLoading
                        ? const SizedBox(
                            height: 18,
                            width: 18,
                            child: CircularProgressIndicator(strokeWidth: 2))
                        : const Icon(Icons.auto_awesome),
                    label: Text(state.isLoading ? 'Analysing…' : 'Run AI scan'),
                  ),
                  if (AppConstants.useMocks && _imageBytes == null)
                    const Padding(
                      padding: EdgeInsets.only(top: 8),
                      child: Text(
                        'Mock mode — you can run a demo scan without a photo.',
                        style: TextStyle(fontSize: 12, color: Colors.grey),
                      ),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          state.when(
            data: (report) =>
                report == null ? const SizedBox.shrink() : ReportCard(report: report),
            loading: () => const SizedBox.shrink(),
            error: (e, _) => Text('Error: $e',
                style: const TextStyle(color: AppColors.danger)),
          ),
        ],
      ),
    );
  }
}
