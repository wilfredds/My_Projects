import 'package:cyclemind_ai/app/theme/app_colors.dart';
import 'package:cyclemind_ai/features/bikes/domain/entities/maintenance_log.dart';
import 'package:flutter/material.dart';

/// The colour for a wear status. Every place that colours wear uses this, so
/// a tile, a garage card and a reminder can't disagree about what's due.
Color statusColor(MaintenanceStatus status) => switch (status) {
      MaintenanceStatus.overdue => AppColors.danger,
      MaintenanceStatus.dueSoon => AppColors.warning,
      MaintenanceStatus.ok => AppColors.success,
    };
