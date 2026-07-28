import { defineFeatureMessages } from "@/lib/i18n/define-messages";

export const authMessages = defineFeatureMessages({
  de: {
    auth: {
          welcomeBack: "Willkommen zurück",
          signInContinue: "Melde dich an, um fortzufahren",
          signUp: "Registrieren",
          email: "E-Mail",
          password: "Passwort",
          keepSignedIn: "Angemeldet bleiben",
          forgotPassword: "Passwort vergessen?",
          forgotPasswordDescription:
            "Wir senden Ihnen einen Link zum Zurücksetzen.",
          backToLogin: "Zurück zur",
          loginNoun: "Anmeldung",
          signingIn: "Anmelden...",
          noAccount: "Noch kein Konto?",
          repeatPassword: "Passwort wiederholen",
          passwordsDoNotMatch: "Passwörter stimmen nicht überein",
          creatingAccount: "Account wird erstellt...",
          alreadyHaveAccount: "Du hast bereits ein Konto?",
          login: "Anmelden",
          createAccountDescription:
            "Erstelle einen Account für den NIS2 Compliance Checker.",
          checkEmailTitle: "Prüfe dein E-Mail-Postfach",
          resetInstructionsSent: "Anweisungen zum Zurücksetzen gesendet",
          resetEmailSent:
            "Wenn für diese E-Mail ein Account existiert, erhältst du eine E-Mail zum Zurücksetzen des Passworts.",
          resetPasswordTitle: "Passwort zurücksetzen",
          resetPasswordDescription:
            "Gib die E-Mail-Adresse für deinen NIS2 Compliance Checker Account ein.",
          sending: "Wird gesendet...",
          sendResetEmail: "E-Mail senden",
          alreadyHaveAnAccount: "Du hast bereits ein Konto?",
          newPassword: "Neues Passwort",
          newPasswordDescription:
            "Gib ein neues Passwort für deinen NIS2 Compliance Checker Account ein.",
          saving: "Wird gespeichert...",
          saveNewPassword: "Neues Passwort speichern",
          errorFallback: "Ein Fehler ist aufgetreten",
          invalidCredentials:
            "E-Mail-Adresse oder Passwort ist nicht korrekt. Bitte prüfen Sie Ihre Eingabe.",
          tooManyAttempts:
            "Zu viele Anmeldeversuche. Bitte warten Sie 15 Minuten oder setzen Sie Ihr Passwort zurück.",
          resetPasswordLink: "← Passwort zurücksetzen",
          sorryTitle: "Entschuldigung, etwas ist schiefgelaufen.",
          codeError: "Code-Fehler",
          unspecifiedError: "Ein unbekannter Fehler ist aufgetreten.",
          authCodeMissing:
            "Der Anmeldelink ist unvollständig. Bitte fordern Sie einen neuen Link an.",
          authCallbackFailed:
            "Die Anmeldung konnte nicht abgeschlossen werden. Bitte versuchen Sie es erneut.",
          authLinkInvalid:
            "Der Bestätigungslink ist ungültig oder abgelaufen. Bitte fordern Sie einen neuen Link an.",
          signupSuccessTitle: "Danke für deine Registrierung!",
          signupSuccessDescription:
            "Prüfe dein E-Mail-Postfach, um deinen Account zu bestätigen.",
          signupSuccessBody:
            "Du hast dich erfolgreich für den NIS2 Compliance Checker registriert. Bitte bestätige deinen Account, bevor du dich anmeldest.",
          signInDescription: "Melden Sie sich an, um fortzufahren.",
          createAccountTitle: "Konto erstellen",
          createAccountSubtitle: "Erstellen Sie Ihr Konto, um zu beginnen.",
          name: "Name",
          namePlaceholder: "Max Mustermann",
          emailPlaceholder: "ihre@email.com",
          passwordPlaceholder: "Min. 10 Zeichen, mind. 1 Zahl",
          passwordRequirements:
            "Das Passwort muss mindestens 10 Zeichen und eine Zahl enthalten.",
          confirmPassword: "Passwort bestätigen",
          acceptTermsPrefix: "Ich akzeptiere die",
          terms: "Nutzungsbedingungen",
          termsConnector: "und die",
          privacyPolicy: "Datenschutzerklärung",
          termsRequired: "Bitte akzeptieren Sie die Nutzungsbedingungen.",
          showPassword: "Passwort anzeigen",
          hidePassword: "Passwort ausblenden",
          backgroundAlt: "Hintergrund",
          logoAlt: "complyX",
        },
  },
  en: {
    auth: {
          welcomeBack: "Welcome back",
          signInContinue: "Sign in to continue",
          signUp: "Sign up",
          email: "Email",
          password: "Password",
          keepSignedIn: "Keep me signed in",
          forgotPassword: "Forgot password?",
          forgotPasswordDescription:
            "We will send you a password reset link.",
          backToLogin: "Back to",
          loginNoun: "login",
          signingIn: "Signing in...",
          noAccount: "No account yet?",
          repeatPassword: "Repeat password",
          passwordsDoNotMatch: "Passwords do not match",
          creatingAccount: "Creating an account...",
          alreadyHaveAccount: "Already have a checker account?",
          login: "Login",
          createAccountDescription:
            "Create an account for the NIS2 Compliance Checker.",
          checkEmailTitle: "Check your email",
          resetInstructionsSent: "Password reset instructions sent",
          resetEmailSent:
            "If a checker account exists for this email, you will receive a password reset email.",
          resetPasswordTitle: "Reset your password",
          resetPasswordDescription:
            "Enter the email for your NIS2 Compliance Checker account.",
          sending: "Sending...",
          sendResetEmail: "Send reset email",
          alreadyHaveAnAccount: "Already have an account?",
          newPassword: "New password",
          newPasswordDescription:
            "Enter a new password for your NIS2 Compliance Checker account.",
          saving: "Saving...",
          saveNewPassword: "Save new password",
          errorFallback: "An error occurred",
          invalidCredentials:
            "Email address or password is incorrect. Please check your input.",
          tooManyAttempts:
            "Too many sign-in attempts. Please wait 15 minutes or reset your password.",
          resetPasswordLink: "← Reset password",
          sorryTitle: "Sorry, something went wrong.",
          codeError: "Code error",
          unspecifiedError: "An unspecified error occurred.",
          authCodeMissing:
            "The sign-in link is incomplete. Please request a new link.",
          authCallbackFailed:
            "Sign-in could not be completed. Please try again.",
          authLinkInvalid:
            "The confirmation link is invalid or expired. Please request a new link.",
          signupSuccessTitle: "Thank you for signing up!",
          signupSuccessDescription:
            "Check your email to confirm your checker account.",
          signupSuccessBody:
            "You've successfully signed up for the NIS2 Compliance Checker. Please confirm your account before signing in.",
          signInDescription: "Sign in to continue.",
          createAccountTitle: "Create account",
          createAccountSubtitle: "Create your account to get started.",
          name: "Name",
          namePlaceholder: "Jane Smith",
          emailPlaceholder: "you@example.com",
          passwordPlaceholder: "Min. 10 characters, including 1 number",
          passwordRequirements:
            "The password must contain at least 10 characters and one number.",
          confirmPassword: "Confirm password",
          acceptTermsPrefix: "I accept the",
          terms: "Terms of use",
          termsConnector: "and the",
          privacyPolicy: "Privacy policy",
          termsRequired: "Please accept the terms of use.",
          showPassword: "Show password",
          hidePassword: "Hide password",
          backgroundAlt: "Background",
          logoAlt: "complyX",
        },
  }
});
