# AI Conversation → Developer Blog Automation Platform

A mobile-first platform that transforms AI conversations into polished developer blog articles, published directly to Dev.to.

## Architecture

```
├── backend/    Node.js · Express · TypeScript · MongoDB · OpenAI
└── mobile/     Flutter · Riverpod · flutter_markdown
```

## User Flow

```
Chat with AI → Save conversation → Generate article (gpt-4o) → Edit → Publish to Dev.to
```

## Backend Setup

```bash
cd backend
cp .env.example .env        # fill in MONGODB_URI, JWT_SECRET, OPENAI_API_KEY
npm install
npm run dev                 # http://localhost:3000
```

### API Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/register | Create account |
| POST | /api/auth/login | Return JWT |
| GET/PUT | /api/auth/me | Profile + Dev.to key |
| GET/POST | /api/conversations | List / create conversations |
| GET/DELETE | /api/conversations/:id | Get with messages / delete |
| POST | /api/conversations/:id/messages | Send message, get AI reply |
| POST | /api/conversations/:id/generate-article | Generate article via gpt-4o |
| GET/PUT/DELETE | /api/articles/:id | Article CRUD |
| POST | /api/articles/:id/publish | Publish to Dev.to |

## Mobile Setup

```bash
cd mobile
flutter pub get
flutter run
```

Configure the backend URL in `mobile/lib/core/api_client.dart` (`baseUrl`) before running on a physical device.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default 3000) |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret for signing JWTs |
| `JWT_EXPIRES_IN` | Token lifetime (default `7d`) |
| `OPENAI_API_KEY` | OpenAI API key (gpt-4o) |

Users store their own Dev.to API key via the Settings screen — it is saved encrypted in their profile.
