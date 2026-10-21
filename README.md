# CivicSignal

**Turn messy community reports into structured, evidence-checked, safe-to-act-on incident information.**

Built for the Hack2Skill *Societal Benefit* challenge: a Gemini-powered app that acts as a bridge between human intent and complex civic systems.

- **Live demo:** `https://civicsignal-vibr.vercel.app/`
- **Demo video:** `ADD-YOUR-VIDEO-LINK`
- **Responder console:** `https://civicsignal-vibr.vercel.app/responder` (passcode shared with judges separately)

## The problem

When a street floods or a road collapses, the first information is messy: a blurry photo, a voice note in a local language, a half-sentence. Responders get a flood of unstructured, unverified messages and cannot tell what is urgent, what is real, or what to do first. Citizens, meanwhile, have no safe guidance.

## What CivicSignal does

1. **Accepts messy input.** Type, upload a photo, record a voice note (any language), and attach a location.
2. **Structures it with Gemini.** One multimodal call returns a typed JSON report: category, preliminary severity and why, detected language and English translation, what the photo actually shows, an immediate-danger flag, and missing details.
3. **Turns it into safe actions.** A ranked "Now / Soon / Later" list split between what a citizen can safely do and what a civic team should check, plus a ready-to-send draft message to the local civic helpline.
4. **Checks the evidence independently.** Gemini's opinion never raises a report's status. Only independent evidence does.
5. **Puts it on a live map.** Fill colour shows severity, ring colour shows verification status.
6. **Keeps a human in charge.** Only a signed-in responder can mark a report *Officially Confirmed*.
7. **Writes situation briefs.** For clusters of nearby reports, Gemini drafts a brief for responders: what we know, what we don't, possible escalation, and suggested priorities.

## Verification model

| Status | How a report gets there |
| --- | --- |
| **Reported** | Default for every submission. AI analysis alone never changes this. |
| **Corroborated** | Independent evidence supports it: recent rainfall data matches a flood report, and/or a report of the same type from a *different device* within 300 m in the last 24 hours. |
| **Officially Confirmed** | A human responder confirmed it in the responder console. Never automatic. |

Each report card lists *why* it has its status.

## Where Gemini is used

- **Report analysis** (`app/api/analyze/route.ts`): multimodal input (text, image, audio) to schema-constrained JSON.
- **Situation briefs** (`app/api/responder/brief/route.ts`): merges clusters of reports into one responder-facing brief.

### Prompt design

- Output is forced into a JSON schema and validated again on the server with `zod`.
- User text, images and audio are explicitly treated as **untrusted data, not instructions**, to resist prompt injection.
- The model is told to use only facts that are present, to list unknowns, never to claim a report is verified, and never to advise entering floodwater or approaching hazards.
- Immediate danger always produces a first action to move to safety and call the emergency number.
- Briefs respect each report's status and cannot describe anything as confirmed beyond it.

## Safety, privacy and trust

- Photos, voice notes and raw typed text are **never stored**. Only the AI summary and an approximate location are saved.
- Photos are resized in the browser, which strips location metadata. Shared coordinates are rounded to about 100 m.
- API keys and the database service key are server-side only. The database table has row-level security enabled, so the browser cannot read or write it directly.
- Per-device rate limit on submissions to protect the Gemini quota. IP addresses are stored only as salted hashes.
- Briefs are responder-only so an AI summary is never mistaken for an official statement.
- Demo data is clearly labelled as synthetic. Nothing is sent to real authorities.

## Known limitations (honest list)

- Device identity is an anonymous browser ID, so a determined person could fake corroboration by clearing site data. A real deployment needs accounts or phone verification.
- Rainfall comes from model-based weather data, not a sensor at the exact spot.
- Place-name geocoding is weaker for small landmarks than for areas and cities. Attaching location gives a more reliable result.
- The responder console uses one shared passcode. A real deployment needs named accounts and an audit log.
- Moderation is manual (responders can hide a report).
- Only flooding reports get the automatic weather cross-check today.

## Tech stack

Next.js (App Router, TypeScript), Google Gemini via `@google/genai`, Supabase (Postgres), Leaflet with OpenStreetMap tiles, Open-Meteo (weather and geocoding), deployed on Vercel.

## Run locally

```bash
npm install
npm run dev
```

Create `.env.local` (never commit it):

```
GEMINI_API_KEY=your-gemini-key
SUPABASE_URL=your-supabase-project-url
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-key
RESPONDER_PASSCODE=a-long-random-passcode
# optional
GEMINI_MODEL=
RATE_LIMIT_SALT=
```

Without the Supabase variables the app still runs, but reports are not saved or shared.

### Database

Run this once in the Supabase SQL editor:

```sql
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  title text not null,
  summary text not null,
  location text not null,
  category text not null check (category in ('Flooding','Road damage','Traffic hazard','Obstruction','Other')),
  severity text not null check (severity in ('Low','Medium','High')),
  status text not null default 'Reported' check (status in ('Reported','Corroborated','Officially Confirmed')),
  lat double precision,
  lon double precision,
  analysis jsonb not null,
  weather jsonb,
  client_hash text,
  hidden boolean not null default false,
  device_hash text,
  evidence jsonb not null default '[]'::jsonb,
  responder_note text,
  confirmed_at timestamptz
);

create index reports_created_at_idx on public.reports (created_at desc);
create index reports_client_hash_idx on public.reports (client_hash, created_at desc);
create index reports_category_created_idx on public.reports (category, created_at desc);

alter table public.reports enable row level security;
```

## Project structure

```
app/
  page.tsx                      public dashboard, report form, map, feed
  responder/page.tsx            responder console and situation briefs
  components/IncidentMap.tsx    Leaflet map
  api/analyze/route.ts          Gemini analysis, weather check, corroboration, save
  api/reports/route.ts          public feed
  api/responder/login/route.ts  responder sign-in
  api/responder/reports/route.ts  list, confirm, hide
  api/responder/brief/route.ts  situation briefs
  lib/                          Supabase client, auth, geo, report mapping
```

## Disclaimer

CivicSignal is a prototype built for a hackathon. It is not an emergency service and does not contact authorities. In an emergency, call your local emergency number.