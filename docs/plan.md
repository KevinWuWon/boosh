# Summary of compacted conversation

The following is a summary of some conversation or work that happened but for which the details have been redacted for the sake of context efficiency.

## What was done

The user requested planning for a mobile app called "Daily Lessons" where users can upload books (e.g., self-help books) and receive daily lessons extracted from them. The app includes:
- Daily lesson delivery with optional exercises
- AI chat functionality to discuss lessons
- Schedule management for lesson delivery times
- Admin UI for uploading books and managing lesson generation

Two design mockups were provided showing the UI flow (welcome screen, book upload, daily lesson view, chat interface, and schedule management).

I explored the existing codebase and found:
- Expo 54 + React Native 0.81.5 already set up
- Convex backend configured and connected (deployment: `dev:perfect-octopus-996`)
- Expo Router configured for file-based routing
- Basic app structure exists but is mostly empty (placeholder template)
- Example code in `/app-example` directory for reference patterns

## User Requirements Clarified

Through questions, the user specified:
1. **Exercises:** Optional per lesson (some lessons have exercises, some don't)
2. **File formats:** PDF only for MVP
3. **AI provider:** Use Vercel AI SDK with Google Gemini provider (via `@ai-sdk/google`)
4. **Lesson generation:** Use Gemini's File Search API to automatically extract lessons from uploaded PDFs
5. **Chat context:** AI should have access to entire book content, not just current lesson

## Research Findings

### Vercel AI SDK + Google Gemini Integration

**Key packages needed:**
- `ai` - Vercel AI SDK core
- `@ai-sdk/google` - Google provider for Gemini (for querying File Search stores)
- `@google/genai` - Google GenAI SDK (for creating stores and uploading files)
- `zod` - Schema validation for structured output
- `@types/node` - Node.js types

**Environment variable:**
- `GOOGLE_GENERATIVE_AI_API_KEY` (add to `.env.local`)

**Implementation approach:**
- Upload PDFs to Google File Search stores using `@google/genai` SDK
  - Create store: `ai.fileSearchStores.create({ config: { displayName: 'book-name' }})`
  - Upload file: `ai.fileSearchStores.uploadToFileSearchStore({ file, fileSearchStoreName })`
  - Files up to 100MB, stored persistently (not temporary)
- Query File Search stores using Vercel AI SDK (`@ai-sdk/google`)
  - Use `generateText` or `generateObject` with `google.tools.fileSearch()` tool
  - Reference store by name: `fileSearchStoreNames: ['projects/.../fileSearchStores/...']`
  - Get citations and grounding metadata in responses
- Convex actions (with `"use node";` directive) provide Node.js runtime needed for both SDKs
- Recommended model: `gemini-2.5-flash` (fast) or `gemini-2.5-pro` (advanced reasoning)

**Architecture pattern:**
```
User uploads PDF → Convex File Storage
  ↓
Convex Mutation: Create book record
  ↓
Convex Action (Node.js):
  - Get PDF from Convex storage using ctx.storage.get() (returns Blob)
  - Create Google File Search store (@google/genai SDK)
    ai.fileSearchStores.create({ config: { displayName: 'book-title' }})
  - Upload PDF to File Search store
    ai.fileSearchStores.uploadToFileSearchStore({ file, fileSearchStoreName })
  - Wait for indexing operation to complete
  - Save store name to book record
  ↓
Convex Action (Node.js):
  - Query File Search store using Vercel AI SDK (@ai-sdk/google)
  - Use google.tools.fileSearch({ fileSearchStoreNames: [...] })
  - Use generateObject() with Zod schema for structured lesson extraction
  - Extract lessons in batches (5-10 per API call)
  - Return structured JSON with Zod validation
  ↓
Convex Mutation: Save lessons to database
  ↓
Schedule next batch if more lessons needed
```

**Important notes:**
- Use `@google/genai` SDK for store creation and file uploads
- Use `@ai-sdk/google` (Vercel AI SDK) for querying with File Search tool
- Google's structured output doesn't support unions or records (need workarounds)
- Process lessons in batches to respect rate limits
- Use Convex scheduled functions for retry logic
- File Search provides automatic citations in responses

## Lessons learnt

1. **Convex + AI SDK integration:** Convex actions with `"use node"` directive provide the Node.js runtime required for both Google GenAI SDK and Vercel AI SDK
2. **File Search architecture:** Use `@google/genai` for creating stores and uploading files, then use `@ai-sdk/google` for querying with the File Search tool
3. **File handling:** Upload PDFs to Convex file storage, then create a File Search store and upload to Google for persistent RAG-based querying
4. **Batching strategy:** Extract 5-10 lessons per API call to respect rate limits and handle large books
5. **Structured output:** Use `generateObject` with Zod schemas and File Search tool rather than passing PDFs directly in requests
6. **Error handling:** Implement exponential backoff for 429 rate limit errors
7. **State management:** With Convex backend, use generated React hooks directly (no need for React Query on top)
8. **Storage strategy:** File Search stores persist indefinitely (unlike Files API which expires after 48 hours), making them ideal for this use case

## Implementation Plan (NOT YET APPROVED OR EXECUTED)

The conversation is in **plan mode** - no code has been written yet. The full implementation plan is below:

---

# Daily Lessons App - Implementation Plan

## Documentation References

**AI & File Search:**
- Vercel AI SDK - Google Provider: https://ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai
- Google Gemini File Search: https://ai.google.dev/gemini-api/docs/file-search
- File Search Stores API: https://ai.google.dev/api/file-search/file-search-stores
- Vercel AI SDK `generateObject()`: https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data

**Convex:**
- Convex Actions (Node.js): https://docs.convex.dev/functions/actions
- Convex File Storage: https://docs.convex.dev/file-storage
- Convex Scheduled Functions: https://docs.convex.dev/scheduling/scheduled-functions
- Convex Cron Jobs: https://docs.convex.dev/scheduling/cron-jobs

**Expo & React Native:**
- Expo Router: https://docs.expo.dev/router/introduction/
- Expo Document Picker: https://docs.expo.dev/versions/latest/sdk/document-picker/
- Expo Notifications: https://docs.expo.dev/versions/latest/sdk/notifications/
- React Native Safe Area Context: https://github.com/th3rdwave/react-native-safe-area-context

---

## Phase 1: MVP - Core Lesson Delivery System

**Goal:** Get basic lesson viewing and completion tracking working

### 1.1 Database Schema (Convex)
- **books** table: `{ title, author, uploadedFileId (storage), fileSearchStoreName (optional), status, createdAt }`
- **lessons** table: `{ bookId, chapterNumber, lessonNumber, title, content, exercise (optional), createdAt }`
- **userProgress** table: `{ userId, lessonId, completedAt, exerciseResponse }`
- **schedules** table: `{ userId, enabled, time, frequency, selectedDays }`

### 1.2 Basic Screens (React Native + Expo Router)
- **Welcome screen** (`/index`): Entry point with "Start Your Journey"
- **Daily lesson screen** (`/lesson/today`): Show today's lesson with content, optional exercise, and completion button
- **Library screen** (`/library`): List of uploaded books (read-only for now)

### 1.3 Convex Functions
- `api.lessons.getToday` - Query to fetch today's lesson based on user progress
- `api.lessons.markComplete` - Mutation to mark lesson as completed
- `api.userProgress.getProgress` - Query to get user's completion stats

### 1.4 UI Components
- LessonCard component (shows title, content, progress bar)
- ExerciseSection component (handles multiple-choice or text input)
- ProgressBar component

---

## Phase 2: Book Upload & AI Lesson Generation

**Goal:** Enable uploading PDFs and automatically generating lessons with AI

### 2.1 Admin Upload Screen
- **Book upload screen** (`/admin/upload`): File picker for PDF, book metadata form
- Use Expo Document Picker for PDF selection
- Upload to Convex file storage

### 2.2 AI Integration (Convex Actions)
- Install: `ai`, `@ai-sdk/google`, `@google/genai`, `zod`
- `internal.ai.createFileSearchStore` - Action to create File Search store and upload PDF
  - Gets PDF from Convex storage (`ctx.storage.get()`)
  - Creates File Search store using `@google/genai`
  - Uploads PDF to store with `uploadToFileSearchStore()`
  - Waits for indexing operation to complete
  - Returns store name (saves to book record)
- `internal.ai.generateLessons` - Action using Vercel AI SDK with File Search
  - Uses `google.tools.fileSearch({ fileSearchStoreNames: [...] })`
  - Calls `generateObject()` with Zod schema for structured output
  - Extracts 5-10 lessons per API call
  - Returns structured lesson objects with citations
- `api.books.upload` - Mutation to create book record and trigger store creation
- `internal.ai.processLessonsJob` - Action to handle batched lesson extraction with retry logic

### 2.3 Processing Status UI
- Show progress indicator during lesson generation
- Display estimated time remaining
- Handle errors gracefully with retry options

### 2.4 Environment Setup
- Add `GOOGLE_GENERATIVE_AI_API_KEY` to `.env.local`

---

## Phase 3: Chat with AI

**Goal:** Allow users to discuss lessons with AI assistant

### 3.1 Chat Screen
- **Chat screen** (`/chat/[lessonId]`): Chat interface for specific lesson or chapter
- Message history display with user/assistant bubbles
- Text input with send button

### 3.2 Chat Backend (Convex)
- **messages** table: `{ lessonId, role, content, createdAt }`
- `api.chat.send` - Mutation to save user message and schedule AI response
- `internal.chat.generateResponse` - Action using AI SDK with File Search
  - Gets book's File Search store name from database
  - Uses `google.tools.fileSearch()` to access full book content
  - Includes conversation history in prompt
  - Generates contextual response with citations from the book

### 3.3 UI Polish
- Auto-scroll to latest message
- Loading indicator while AI responds
- "Chat with AI about this" button on lesson screen

---

## Phase 4: Schedule Management

**Goal:** Let users configure when they receive daily lessons

### 4.1 Schedule Screen
- **Settings screen** (`/settings/schedule`): Configure lesson delivery time, frequency, days
- Time picker component
- Frequency selector (Every Day, Weekdays Only, Custom)
- Day of week toggles for custom frequency

### 4.2 Notification System
- Install `expo-notifications`
- `api.schedules.update` - Mutation to save user schedule
- `internal.notifications.scheduleDailyLesson` - Cron job to send notifications
- Background notification handler to show lesson preview

### 4.3 Convex Crons
- Define daily cron in `convex/crons.ts` to check schedules and send notifications

---

## Phase 5: Polish & Enhanced Features

**Goal:** Improve UX and add nice-to-have features

### 5.1 Enhanced UI
- Add book cover image support
- Animated progress transitions (using Reanimated)
- Dark mode support (using `useColorScheme`)
- Pull-to-refresh on lesson screen
- Swipe gestures for navigation between lessons

### 5.2 User Management
- Simple authentication (Convex Auth or Clerk)
- User profiles with stats (streak, total lessons completed)
- Onboarding flow

### 5.3 Admin Dashboard
- **Admin home** (`/admin`): Overview of all books, lesson generation status
- Edit/delete books functionality
- Manual lesson editing capability
- Analytics on user engagement

### 5.4 Exercise Enhancements
- Support scenario-based exercises (text input)
- Exercise feedback from AI
- Track exercise completion separately from lesson completion

---

## Technical Architecture Summary

**Frontend:**
- Expo Router for navigation (file-based routing)
- React Native components with TypeScript
- Convex React hooks for data fetching
- Safe area handling with SafeAreaView
- Reanimated for smooth animations

**Backend:**
- Convex for database, file storage, real-time sync
- Convex actions with "use node" for AI integration
- Vercel AI SDK + Google Gemini for lesson generation and chat
- Convex crons for scheduled notifications
- Zod for validation and structured AI outputs

**Data Flow:**
1. User uploads PDF → Convex file storage
2. AI action processes PDF → generates lessons (batched)
3. Lessons stored in Convex → synced to app via queries
4. User views lesson → marks complete → progress tracked
5. User chats → AI responds with full book context
6. Cron triggers → sends notifications based on schedule

---

## Implementation Order

**Phase 1** (MVP): 2-3 days - Get basic lesson viewing working with hardcoded lessons
**Phase 2** (AI Generation): 2-3 days - Upload and AI processing pipeline
**Phase 3** (Chat): 1-2 days - Add conversational AI feature
**Phase 4** (Scheduling): 1-2 days - Notifications and schedule management
**Phase 5** (Polish): 2-3 days - UX improvements and admin features

**Total Estimated Time:** 8-13 days for full implementation

Each phase builds on the previous and delivers a working increment. We can stop after any phase for feedback and iteration.

---

## Next Steps

After loading this summary:
1. Present the implementation plan to the user for approval (or acknowledge it's already been presented)
2. Once approved, begin with Phase 1 implementation
3. Build incrementally, one phase at a time
