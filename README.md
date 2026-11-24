# RouteFuel Optimizer — Team 17

An educational two-segment route optimizer based on the CalSymPy Team 17 report. The browser app calculates a modeled fuel-minimizing speed plan, authenticates users with Google through Supabase, and can save each signed-in user's plans to Supabase Postgres.

## Architecture

- `frontend/` is the React + TypeScript web app. Firebase Hosting serves its built static files.
- Supabase Auth handles Google sign-in. Supabase Postgres stores saved route plans, with Row Level Security (RLS) limiting each signed-in user to their own rows.
- `app.py` and `optimizer.py` preserve the original Streamlit prototype and Python optimizer.
- Firebase Hosting serves the frontend; it does not run the Python Streamlit app. The deployed frontend uses the matching TypeScript optimizer.

## Route model

The default example follows the project report: 40 km, 60 km, a 2-hour deadline, and a 20–80 km/h speed range.

```text
F(v1, v2) = d1 (0.002 v1^2 + 2 / v1) + d2 (0.003 v2^2 + 2 / v2)
d1 / v1 + d2 / v2 = delivery time
```

The browser implementation uses the same coefficients and allocates the fixed delivery time between the segments. It checks the feasible endpoints and searches the convex one-variable objective for its minimum.

**Model limitation:** these coefficients are illustrative teaching values. Results are in model units, not litres. The model assumes constant average speeds and does not include traffic, stops, road grade, payload, weather, acceleration, vehicle data, or route selection.

## Run the web app locally

Install Node.js (which includes npm). In VS Code, open a terminal at the repository root and run:

```powershell
cd frontend
Copy-Item .env.example .env.local
npm.cmd install
npm.cmd run dev
```

The frontend opens at `http://localhost:5173`. Without Supabase environment values, route optimization and the chart still work in preview mode; Google sign-in and saved plans remain disabled.

Edit `frontend/.env.local` with your Supabase project URL and **publishable** key:

```dotenv
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

The older public `anon` key is accepted as a fallback by the client. Never place a Supabase secret key or `service_role` key in this file, the browser app, or Git. Vite embeds `VITE_` variables in the public build, so only public client values belong here. Keep `.env.local` private; the repository ignores it.

## Configure Supabase and Google sign-in

1. Create a Supabase project and run [`supabase/migrations/202611240001_create_route_runs.sql`](supabase/migrations/202611240001_create_route_runs.sql) in the Supabase SQL Editor. It creates `route_runs`, enables RLS, grants only read/insert operations, scopes rows to `auth.uid()`, and checks that saved speeds and travel times are consistent.
2. Copy the project's URL and publishable key into `frontend/.env.local`.
3. In Supabase, open **Authentication → URL Configuration**. Set the Site URL to your Firebase website origin when deployed. Add both `http://localhost:5173` and your Firebase/custom-domain origin to the allowed redirect URLs.
4. In Google Cloud Console, create an OAuth client with application type **Web application**. Add `http://localhost:5173` and your deployed website origin to **Authorized JavaScript origins**. Add the callback URL shown in Supabase's Google provider setup to **Authorized redirect URIs**. The callback is the Supabase Auth URL, usually `https://<project-ref>.supabase.co/auth/v1/callback`; Google sends the user to Supabase first, then Supabase returns them to RouteFuel.
5. In Supabase, open **Authentication → Providers → Google**, enable the provider, and enter the Google OAuth client ID and secret. Add or update Google origins and Supabase redirect allow-list entries when you add a custom domain.

If the Google OAuth audience is External and its publishing status is Testing, add each teammate's Google account to the test-user list before they try signing in.

The app calls Supabase `signInWithOAuth({ provider: "google" })`. The public Supabase key identifies this browser app; the signed-in user's Supabase session is used to access Postgres, where RLS enforces row ownership.

## Deploy to Firebase Hosting

The repository already includes `firebase.json`; it publishes `frontend/dist` and rewrites app routes to `index.html`.

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/).
2. Install the Firebase CLI once: `npm.cmd install --global firebase-tools`.
3. From a terminal at the repository root, run `firebase.cmd login` and `firebase.cmd use --add`, then select your Firebase project.
4. Build with your local Supabase settings: `cd frontend`, `npm.cmd install`, `npm.cmd run build`, then return to the repository root with `cd ..`.
5. Publish the static web app with `firebase.cmd deploy --only hosting`.
6. Add the resulting `https://<firebase-project-id>.web.app` origin to the Supabase Auth URL allow list and to Google's Authorized JavaScript origins. Add the `firebaseapp.com` origin too if you use it.

Firebase Hosting is designed to serve the app's static assets and supports SPA rewrites; it does not host the Python Streamlit server. See [Firebase Hosting quickstart](https://firebase.google.com/docs/hosting/quickstart) and [Firebase Hosting rewrites](https://firebase.google.com/docs/hosting/full-config#rewrites).

## Original Streamlit prototype

The Python version remains available for the project's original workflow. Python 3.10 or later is recommended:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
streamlit run app.py
```

The Streamlit prototype does not use Supabase sign-in or persistence; the React web app is the Firebase deployment target.

## Official setup references

- [Supabase Google sign-in](https://supabase.com/docs/guides/auth/social-sign-in/auth-google)
- [Supabase JavaScript `signInWithOAuth`](https://supabase.com/docs/reference/javascript/auth-signinwithoauth)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase API keys and safe key types](https://supabase.com/docs/guides/getting-started/api-keys)
- [Firebase Hosting quickstart](https://firebase.google.com/docs/hosting/quickstart)
- [Google Auth Platform app audience and testing status](https://support.google.com/cloud/answer/15549945)
