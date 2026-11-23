import 'package:flutter_test/flutter_test.dart';
import 'package:ride_doctor/features/race_prep/domain/race_limits.dart';

void main() {
  group('parseClockTime', () {
    test('reads 24-hour times, with or without a leading zero', () {
      expect(parseClockTime('06:30'), (6, 30));
      expect(parseClockTime('6:30'), (6, 30));
      expect(parseClockTime(' 19:05 '), (19, 5));
      expect(parseClockTime('00:00'), (0, 0));
      expect(parseClockTime('23:59'), (23, 59));
    });

    test('accepts a dot, which number keyboards make easier to type', () {
      expect(parseClockTime('6.30'), (6, 30));
    });

    test('rejects times that do not exist and anything else', () {
      expect(parseClockTime('24:00'), isNull);
      expect(parseClockTime('12:60'), isNull);
      expect(parseClockTime('6:5'), isNull);
      expect(parseClockTime('630'), isNull);
      expect(parseClockTime('6:30 am'), isNull);
      expect(parseClockTime(''), isNull);
    });
  });
}
