# Share the Light

An interactive digital wish wall developed for CCPBM's Ta Saung Tine Festival celebration. The application allows employees from different company locations to submit festival wishes and share them on a centralized live display. 

The project aims to encourage employee engagement, celebrate the spirit of Ta Saung Tine and create a shared digital experience across CCPBM locations. 


## Project Overview 
Project Name: Share the Light 
Event: Ta Saung Tine Festival 2026 
Organization: Coca Cola Pinya Beverages Myannmar 
Project Type: Internal Employee Engagement Application 

## Development

- Encourage employee participation in the Ta Saung Tine Festival.

- Provide a centralized platform for collecting employee wishes.

- Display approved wishes from different company locations on a shared screen.

- Create an interactive and engaging festival experience.

- Support centralized content moderation and management.

## Features 

1) Employee Wish Submission
-- Employees can access the application through a QR code
-- Submit their name, employee email, location and a wish
-- Submit wishes in Burmese or English

   <img width="1919" height="1015" alt="image" src="https://github.com/user-attachments/assets/cc64eddd-cda1-431f-b209-055f90c421f1" />
   
2) Live Wish Display
-- Display approved employee wishes on a shared screen
-- Show wishes from participating company locations.
-- Automatically refresh the display to show newly approved wishes.

<img width="1897" height="1010" alt="image" src="https://github.com/user-attachments/assets/424438dd-d7d6-4660-9c3a-196c932876a6" />

3) Admin Management
-- PIN-protected administrator access
-- Admin can review, approve, or reject submitted wishes
-- Manage automatic approval settings
-- Search and export wish records
-- Clear submitted wishes when required

   <img width="1880" height="967" alt="image" src="https://github.com/user-attachments/assets/13664c29-036a-4209-8b41-8d3373bb3381" />

   <img width="1884" height="1006" alt="image" src="https://github.com/user-attachments/assets/334f8b54-cff0-4cff-b0ee-b5e783203376" />


## Technology Stack

Frontend: JavaScript 

Backend: Node.js / TypeScript

Database: Azure Cosmos DB for NoSQL

Hosting: Azure Static Web Apps

Version Control: GitHub

Development Platform: Lovable

## Application Pages 
/ =>  Employee wish submission form 
/display  => Live display of approved wishes 
/ admin => Administrator dashboard 
/ submit => Redirects to the submission page 


## Azure Static Web Apps and Cosmos DB

The workflow builds the SPA directly to `.output/public/index.html`, builds the Node.js
TypeScript Functions in `api`, and deploys both to Static Web Apps. The in-memory Vite
middleware is **serve-only**, never included in a production build. Static Web Apps
routes `/api/*` to its built-in Functions; no external API URL is used.

1. Provision a Cosmos DB **NoSQL account**. On the first API request, the app creates
   database `makeawish-db` and container `wishes` with partition key **`/plant`** if
   missing; the account key must permit database/container creation. An existing
   container with a different partition key fails explicitly rather than being replaced.
   Keep consistent automatic indexing (including `/status/?`
   and `/created_on/?`); a composite index on `status ASC, created_on DESC` can reduce
   the RU cost of filtered recent-wish queries. This implementation deliberately fans
   out across the four plants for the combined display; `/plant` has low cardinality,
   so monitor hot partitions and RU consumption as the event scales.
2. Set these **server-side Static Web Apps application settings**, never `VITE_*` variables:

   | Setting            | Default                                     |
   | ------------------ | ------------------------------------------- |
   | `COSMOS_ENDPOINT`  | required Cosmos account endpoint            |
   | `COSMOS_KEY`       | required Cosmos account key                 |
   | `COSMOS_DATABASE`  | `makeawish-db`                              |
   | `COSMOS_CONTAINER` | `wishes`                                    |
   | `ADMIN_PIN`        | `2026` — **override before a public event** |

3. Configure the existing GitHub Actions Static Web Apps deployment secret and deploy.
   The API uses the Node 20 Functions runtime. Cosmos credentials never reach the browser.
   The client is reused across warm invocations; the JavaScript SDK uses HTTPS gateway
   connections (not the .NET SDK's Direct/TCP mode).

The workflow compiles and installs API dependencies under Node 20 before switching
to Node 24 for the frontend. The Functions entry is `api/dist/api/src/index.js`;
compiled shared validation is included under `api/dist/shared`. The prebuilt API
deployment includes `api/package.json`, `api/host.json`, `api/dist` and production
dependencies. No Cosmos network operation or credential validation runs during worker
module loading. Requests share a cached initialization promise; failed provisioning
is retried on the next request without replacing the singleton client.

For a submission failure, inspect the JSON response in the browser Network tab.
Unexpected/configuration/Cosmos failures return HTTP **500** with `{ error, details }`,
with Cosmos keys and configured admin PINs redacted. Validation/authentication,
wish-not-found, size-limit and rate-limit responses keep their specific statuses.
Enable Application Insights for full server logs. A platform-level 503 before the
handler runs still requires checking Azure deployment/runtime logs.
The root `.env` is local-only: it does **not** populate Azure application settings.
After changing settings or deploying these fixes, verify the live API before the event;
this repository's mocked tests do not establish live account connectivity.

Wishes use UUID v4 `id`, `employee_name`, normalized company `email`, `plant`, `message`,
`status`, and ISO `created_on`. The singleton `{ id: "app-settings", plant: "SYSTEM",
autoApprove: true, updatedAt: "<ISO timestamp>" }` is upserted on the first settings read
if missing or malformed. Repairs persist the default `autoApprove: true` before any wish
is saved. Legacy settings with a valid boolean flag receive timestamp metadata without
changing that flag. GET settings and submissions share this repair logic; PATCH/PUT
always upsert a complete document in the `SYSTEM` partition with a fresh timestamp.
Changing Auto-Approve affects future submissions only. Real database read/write failures
still surface; they do not silently approve or pretend a submission was saved.

### API

| Method and path                   | Access / body                                                           |
| --------------------------------- | ----------------------------------------------------------------------- |
| `GET /api/wishes?status=approved` | Public: `{ wishes, counts: { HTY, HB, CDC, JC } }`; no emails           |
| `GET /api/wishes?status=all`      | `x-admin-pin`: all wishes including emails, newest first                |
| `POST /api/wishes`                | `{ employee_name, email, plant, message }`; returns created wish        |
| `POST /api/wishes/:id/reactions`  | `{ plant, visitorId, reaction }`; public, approved wishes only          |
| `PATCH /api/wishes/:id`           | `x-admin-pin`; `{ plant, status?: "approved" \| "rejected", message? }` |
| `DELETE /api/wishes/:id`          | `x-admin-pin`; JSON `{ plant }`                                         |
| `DELETE /api/wishes/all`          | `x-admin-pin`; deletes wishes, preserves settings                       |
| `GET /api/settings`               | Public `{ autoApprove }`                                                |
| `PATCH / PUT /api/settings`       | `x-admin-pin`; `{ autoApprove: boolean }`                               |

The admin PIN is kept in page memory, not localStorage. This shared PIN is a lightweight
event gate, not individual corporate authentication. Use HTTPS and a strong non-default PIN;
for a broadly public deployment, add platform-level abuse protection and managed identity/
company sign-in as appropriate. The company email suffix is validated, not email ownership.
CSV includes employee emails; treat exports as private. Reset is permanent, non-transactional
across partitions, and bounded to ten concurrent deletes. Avoid new submissions during an
event reset; on an error, refresh and retry to clear any remaining documents.

### Wish reactions

The public display supports Like, Love, Haha, Wow, and Thankful reactions. Reaction
documents use the existing Cosmos `wishes` container and `/plant` partition key; no
database replacement, migration, new service, or additional application setting is
required. The API hashes a browser-generated anonymous visitor UUID and combines it
with the wish ID to derive a deterministic reaction document ID. A single upserted
document therefore represents that visitor's one current reaction for that wish;
changing or removing it is enforced by the API, not only by the UI. Reaction writes
first verify the wish is approved. Admin wish listings exclude reaction documents.

The approved-wish response includes reaction totals and the current visitor's selection.
The existing display polling refreshes them every five seconds, so other open displays
see changes without reloading. The UUID is saved in browser local storage as an
anonymous identity only; reaction counts and selections themselves live in Cosmos DB.
The Vite in-memory API and offline/static-preview browser fallback also support the
controls for testing, but their reaction data is isolated from Cosmos and other devices.

### Local development and validation

For ordinary local testing, no Azure tools or credentials are required:

```sh
npm ci
npm run dev -- --port 8081
```

Open `http://localhost:8081`. The dev-only middleware handles all wish/settings endpoints
in memory, with festive Burmese/English samples across every plant. Its admin PIN is
`ADMIN_PIN` from the process or local Vite environment, default `2026`. All tabs connected
to that server share its state. It resets on restart and **never writes to Cosmos DB**.

The root `.env.example` lists all settings; copy it to `.env` if a local template is
not already present. Both `.env` and `api/local.settings.json` are gitignored.
Vite reads `.env` for development; real Functions read `process.env`, populated by
Azure application settings or the Functions `local.settings.json` file. Set Cosmos
credentials only in those server-side settings, never in `VITE_*` variables.

For production-style static preview, run `npm run build` then `npm run preview`.
The dedicated preview config serves `.output/public` directly instead of starting
TanStack's SSR preview (which expects a different server output). `/api/*` deliberately
returns 404 there so the browser fallback can take over, rather than returning SPA HTML.

For static preview (or when `/api` is missing/unreachable), the API client uses the
separate `share-light.local-api.v1` localStorage store, seeded once with the same samples.
Display, submission, moderation, settings, CSV and reset all work against this store.
The browser-demo admin PIN is `VITE_ADMIN_PIN` (default `2026`): this public build-time
value is demo-only UI gating, not security. Real API authorization uses only `ADMIN_PIN`.
Names and emails saved there can be read or changed by anyone using that browser.
Blocked/full or malformed storage produces an explicit error, not a false successful save.
Clearing wishes persists an empty collection; samples do not reappear after refresh.

Optional wish photos are compressed in the browser and saved separately under
`share-light.wish-images.v1`, keyed by the existing wish ID. Photo data is never
sent to the API or stored in Cosmos DB. Admin and display pages can show a photo
only in the same browser profile where it was submitted; localStorage does not
synchronize across devices, browsers, or plants, and clearing browser data can
remove photos. This is temporary development storage, not a production image
hosting solution. A full localStorage quota prevents photo wishes from submitting
and displays an error rather than silently dropping the photo.

Submit and Admin show the mode notice; the public display deliberately has no demo banner.
Browser fallback stays
active for the page session until **Retry live API** succeeds (or the page reloads), so
local edits aren't silently mixed with live data. No automatic upload/replay happens when
connectivity returns; browser demo data remains isolated and can be exported before switching.
Only missing-endpoint 404s and failed network connections trigger fallback: validation,
authentication, rate-limit and server errors still surface, as does a real API's
`Wish not found.` response. Aborting a request never activates the fallback.

To test the **real Cosmos-backed Functions** locally, install Azure Functions Core Tools v4
and the Azure Static Web Apps CLI separately, then:

```sh
npm ci
npm ci --prefix api
npm run build --prefix api
cp api/local.settings.json.example api/local.settings.json
# Fill in local.settings.json with your development Cosmos account credentials.
# In separate terminals:
npm run dev -- --port 5173
cd api && npm start
# From the repository root, proxy both:
swa start http://localhost:5173 --api-devserver-url http://localhost:7071
```

Use the SWA proxy URL (normally `http://localhost:4280`) so `/api` reaches Functions
rather than Vite's local demo. Never commit `local.settings.json`.

```sh
npm test
npx tsc --noEmit
npm run build --prefix api
npm run build
```

API tests mock the Cosmos boundary; a real account/emulator smoke test is still needed
after configuring credentials. Production assets are `/background.png`, `/qr-code.png`
and `/TCCC-UnityText-Regular.ttf`. Ensure the supplied QR image encodes the deployed
root URL (or the compatible `/submit` URL) before displaying it at the event.
