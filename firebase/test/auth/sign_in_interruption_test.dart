import 'package:checks/checks.dart';
import 'package:eigen_firebase/src/auth/firebase_auth_gateway.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_sign_in/google_sign_in.dart';

void main() {
  test('dismissing the popup, or opening a second one, is a cancellation', () {
    for (final code in [
      'popup-closed-by-user',
      'cancelled-popup-request',
      'user-cancelled',
    ]) {
      check(
        signInInterruptionOf(FirebaseAuthException(code: code)),
        because: code,
      ).equals(SignInInterruption.cancelled);
    }
  });

  test('a popup the browser refused is blocked, not cancelled', () {
    check(signInInterruptionOf(FirebaseAuthException(code: 'popup-blocked')))
        .equals(SignInInterruption.blocked);
  });

  test('dismissing the native account picker is a cancellation', () {
    check(
      signInInterruptionOf(
        const GoogleSignInException(code: GoogleSignInExceptionCode.canceled),
      ),
    ).equals(SignInInterruption.cancelled);
  });

  test('anything else is a failure', () {
    check(
      signInInterruptionOf(
        FirebaseAuthException(code: 'network-request-failed'),
      ),
    ).isNull();
    check(
      signInInterruptionOf(
        const GoogleSignInException(
          code: GoogleSignInExceptionCode.clientConfigurationError,
        ),
      ),
    ).isNull();
    check(signInInterruptionOf(StateError('boom'))).isNull();
  });
}
