# Voice Unlock PWA

A Progressive Web App (PWA) for secure voice-based device unlock using MFCC voice fingerprinting and Supabase.

Built for LASUASA (Lagos State University Architecture Students' Association) Elections.

## 🎤 Features

- ✅ Voice enrollment (5 recordings of passphrase)
- ✅ Voice verification for device unlock
- ✅ Installable on home screen (iOS & Android)
- ✅ Works offline with service worker
- ✅ Secure Supabase backend with RLS
- ✅ LASUASA branding (dark green + gold)
- ✅ Mobile-first responsive design

## 🚀 Quick Start

### Prerequisites
- Node.js v18+
- npm or yarn
- Supabase account (free)

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/voice-unlock-pwa.git
cd voice-unlock-pwa

# Install dependencies
npm install

# Copy environment template
cp .env.local.example .env.local

# Add your Supabase credentials to .env.local
# Edit .env.local and add:
# NEXT_PUBLIC_SUPABASE_URL=your_url
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🔧 Setup

### 1. Supabase Configuration

Run this SQL in your Supabase project to create the required tables:

```sql
-- See voice_unlock_schema.sql in project docs
```

Tables created:
- `users` - User profiles
- `voice_profiles` - Enrolled voice data
- `voice_unlock_logs` - Audit trail
- `voice_enrollment_sessions` - Enrollment tracking

### 2. Environment Variables

Create `.env.local` (copy from `.env.local.example`):

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

**⚠️ Never commit `.env.local` to GitHub!**

## 📱 Installation on Phone

### Android
1. Open app in Chrome
2. Tap "Install" banner
3. Confirm
4. Icon appears on home screen

### iOS
1. Open app in Safari
2. Tap Share icon
3. Tap "Add to Home Screen"
4. Confirm
5. Icon appears on home screen

## 🏗️ Project Structure

```
voice-unlock-pwa/
├── app/
│   ├── page.tsx           # Main app component
│   └── layout.tsx         # Root HTML layout
├── public/
│   └── manifest.json      # PWA manifest
├── package.json           # Dependencies
├── next.config.js         # Next.js config
├── vercel.json            # Vercel deployment
└── .env.local.example     # Environment template
```

## 🎨 Features Overview

### Home Screen
- Displays voice unlock status
- Option to enroll or verify
- App installation prompt (PWA)

### Enrollment
- Record 5 samples of passphrase
- Extract MFCC voice fingerprints
- Save encrypted profile to Supabase

### Verification
- Record 1 sample
- Compare fingerprints
- Show match score (0-100%)
- Unlock if score >= 85%

## 🔒 Security

- **Row-Level Security (RLS)** - Users can only access their own data
- **HTTPS Only** - All communication encrypted
- **No Audio Storage** - Only MFCC features stored, not actual audio
- **Encrypted Fingerprints** - Voice data encrypted at rest
- **Brute-Force Protection** - Account lockout after failed attempts

## 📦 Deployment

### Deploy to Vercel

1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click "Import Project"
4. Select your GitHub repository
5. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
6. Click "Deploy"

Your app will be live in ~2 minutes!

## 🧪 Testing

```bash
# Development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## 📊 API Reference

### Voice Fingerprinting

The app uses MFCC (Mel-Frequency Cepstral Coefficients) for voice analysis:

- **Extract Features**: Convert audio → MFCC vectors
- **Compare**: Cosine similarity between fingerprints
- **Threshold**: 0.85 (85% match required for unlock)

### Supabase Tables

#### voice_profiles
```sql
- id (UUID)
- user_id (TEXT)
- passphrase (TEXT) - "Themis Vanguard"
- voice_fingerprint (BYTEA) - Encrypted MFCC data
- confidence_threshold (FLOAT) - 0.85
- verification_count (INT)
- failed_attempts (INT)
- locked_until (TIMESTAMP) - Anti-brute-force
```

#### voice_unlock_logs
```sql
- id (UUID)
- user_id (TEXT)
- attempt_timestamp (TIMESTAMP)
- success (BOOLEAN)
- confidence_score (FLOAT)
- device_info (JSONB)
- error_message (TEXT)
```

## 🐛 Troubleshooting

### Microphone Not Working
- Allow microphone in browser settings
- Ensure HTTPS (not localhost for production)
- Try Chrome, Edge, or Samsung Internet

### Enrollment Failed
- Check Supabase credentials in `.env.local`
- Verify RLS policies are enabled
- Check browser console for errors

### App Won't Install
- Make sure it's deployed on HTTPS
- Use Chrome, Edge, or Samsung Internet (iOS has limitations)
- Clear browser cache

### Verification Score Low
- Speak clearly in quiet environment
- Ensure microphone is not muted
- Re-enroll if voice changes (cold, illness, etc)

## 📈 Next Features

- [ ] User dashboard with unlock history
- [ ] Voice profile strength indicator
- [ ] Backup/recovery options
- [ ] Multi-factor authentication (voice + PIN)
- [ ] Admin analytics dashboard
- [ ] Voice profile re-enrollment reminders

## 📝 License

Built for LASUASA Election System

## 📞 Support

For issues or questions:
1. Check [Supabase Docs](https://supabase.com/docs)
2. Check [Next.js Docs](https://nextjs.org/docs)
3. Check browser console (F12) for error messages

## 👨‍💻 Development

Built with:
- **Next.js 14** - React framework
- **TypeScript** - Type safety
- **Supabase** - Backend & database
- **Web Audio API** - Voice recording
- **PWA** - Progressive Web App support

---

**Made with 🎤 for LASUASA**
