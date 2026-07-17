<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# C-Finance

C-Finance is a personal finance command center for tracking transactions,
recurring bills, subscriptions, budgets, and optional AI-assisted insights.

View your app in AI Studio: https://ai.studio/apps/6bf3ec5e-f6f1-479a-a5df-b13a37f32e30

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env.local` and set `GEMINI_API_KEY` if AI insights are desired
3. Run the app:
   `npm run dev`

Firebase Authentication and Firestore must be enabled for the project described
by `firebase-applet-config.json`. Deploy `firestore.rules` before allowing users
to store real financial records. AI insights are optional; all dashboard math is
calculated deterministically in the application.

## Validation

```bash
npm run lint
npm test
npm run test:rules
npm run build
```

The Firestore rules test starts a local emulator and requires Java 17 or newer.

## Production checklist

1. Add the production hostname to Firebase Authentication's authorized domains.
2. Set `GEMINI_API_KEY` as a server-side environment variable if AI insights are enabled.
3. Deploy the checked-in rules to the configured named database with
   `npx firebase deploy --only firestore:ai-studio-6bf3ec5e-f6f1-479a-a5df-b13a37f32e30`.
4. Run the validation commands above against the release commit.
5. Test Google sign-in, one transaction, one bill payment, and one budget on desktop and mobile.

Financial calculations stay in the application. When the user explicitly requests
AI insights, only the aggregate totals and category totals displayed by the dashboard
are sent to Gemini; individual transaction notes are not included.
