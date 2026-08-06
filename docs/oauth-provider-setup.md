# OAuth Provider Setup — Owner Actions Required

Google and Apple sign-in buttons are now rendered in the AuthGate component. Before they
work in production, the following Supabase Dashboard configuration is required.

## Google OAuth

### 1. Create a Google Cloud Console project
- Go to https://console.cloud.google.com/apis/credentials
- Create a new project or select an existing one

### 2. Configure OAuth consent screen
- Navigate to **APIs & Services → OAuth consent screen**
- Select **External** user type
- Fill in:
  - App name: `Impulsa Talentos`
  - User support email: (your email)
  - Developer contact: (your email)
- Add scopes: `email`, `profile`, `openid`
- Add test users (your email) for development

### 3. Create OAuth 2.0 credentials
- Go to **APIs & Services → Credentials**
- Click **Create Credentials → OAuth client ID**
- Application type: **Web application**
- Name: `Impulsa Talentos`
- Authorized redirect URIs (add BOTH):
  - `https://<project-ref>.supabase.co/auth/v1/callback` (production)
  - `http://localhost:3000/auth/v1/callback` (local dev)
- Copy the **Client ID** and **Client Secret**

### 4. Configure in Supabase Dashboard
- Go to https://supabase.com/dashboard → your project → **Authentication → Providers**
- Click **Google**
- Toggle **Enabled** ON
- Paste the **Client ID** and **Client Secret**
- Save

## Apple OAuth

### 1. Apple Developer Program
- Requires an active Apple Developer Program membership ($99/year)
- Go to https://developer.apple.com/account

### 2. Create a Service ID
- Navigate to **Certificates, Identifiers & Profiles → Identifiers**
- Click **+** → **Service IDs**
- Description: `Impulsa Talentos Sign-In`
- Identifier: `com.impulsatalentos.signin`
- Check **Sign In with Apple**
- Click **Configure** and set:
  - Domains: `impulsatalentos.com`
  - Return URLs: `https://<project-ref>.supabase.co/auth/v1/callback`
- Save

### 3. Create a Private Key
- **Certificates, Identifiers & Profiles → Keys**
- Click **+** → enter key name
- Check **Sign In with Apple**
- Click **Configure** → select your primary App ID
- Click **Continue** → **Register**
- Download the `.p8` key file (only once!)

### 4. Configure in Supabase Dashboard
- Go to https://supabase.com/dashboard → your project → **Authentication → Providers**
- Click **Apple**
- Toggle **Enabled** ON
- Fill in:
  - **Service ID**: your Service ID identifier
  - **Team ID**: Apple Developer Team ID
  - **Key ID**: key ID from `.p8` file
  - **Private Key**: contents of `.p8` file (include BEGIN/END PRIVATE KEY)
- Save

## Supabase Redirect URLs
- Site URL: your production domain
- Redirect URLs: add `https://yourdomain.com/**` and `http://localhost:3000/**`
