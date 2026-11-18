# Coldline deployment

## Public release and build

[GitHub Pages](https://uniqkode.github.io/coldline/) runs the public demonstration and prepares free-form enquiry drafts. It cannot receive private forms, authenticate organizations, synchronize records, or hold model secrets.

Run `npm test`, `npm run check`, and `npm run build:azure`. The output separates website-only `dist/site` from Functions code, host configuration, and locked dependency manifests in `dist/backend`. No server code or secrets are included in the static package.

A production build requires the exact HTTPS `COLDLINE_RUNTIME_ORIGIN` without a trailing slash and verified `ENTRA_TENANT_ID`. It enables tenant-restricted Entra sign-in, protects organization routes, fixes API calls to that origin, and updates canonical URLs. Public repository configuration stays in demonstration mode.

Use a separate **bring-your-own Functions app**, linked to SWA Standard. This supports managed identity, Key Vault references, and outbound private networking. Keep the default `/api` HTTP prefix. SWA managed functions do not provide these workload-identity features.

## Manual deployment

`.github/workflows/azure-production.yml` runs only through `workflow_dispatch`. It can provision paid resources, including Premium compute. No Git push activates it.

Create the GitHub environment `azure-production` with these secrets:

| Secret | Purpose |
| --- | --- |
| `AZURE_CLIENT_ID` | Federated GitHub deployment identity |
| `AZURE_TENANT_ID` | Actual Azure/Entra directory |
| `AZURE_SUBSCRIPTION_ID` | Approved subscription |
| `ENTRA_CLIENT_ID` / `ENTRA_CLIENT_SECRET` | Tenant-restricted website app registration |
| `COLDLINE_MEMBERSHIPS_JSON` | Verified SWA identities mapped to organization, roles, and optional trial expiry |
| `COLDLINE_ENQUIRY_HASH_SALT` | At least 24 random characters |
| `COLDLINE_OWNER_USER_IDS` | Comma-separated verified IDs allowed to read private enquiries |

Configure GitHub OIDC for this repository/environment. The deployment identity needs resource creation and scoped role-assignment rights. Supply an existing resource group. Do not commit identity passwords, customer memberships, or actual secrets.

Set variables `AZURE_OPENAI_ACCOUNT_NAME` and `AZURE_OPENAI_DEPLOYMENT` for a compatible existing account in the same resource group. The template grants the API identity the Cognitive Services OpenAI User role. Blank model configuration keeps analysis unavailable while other API features can operate.

Run the manual workflow with the resource group, prefix, and private-networking choice. It provisions, links, verifies platform authentication, installs locked Node dependencies, publishes the API, and uploads the frontend. Its HTTP function stays disabled until linked authentication is verified. Re-running infrastructure temporarily disables it again; use a deployment window.

Add the actual Entra redirect URI `https://YOUR-VERIFIED-HOST/.auth/login/aad/callback`. To use a custom domain, verify a domain you own in Azure, update the API’s `COLDLINE_PUBLIC_ORIGIN`, rebuild with that origin, and register its redirect URI. No unverified domain is assumed.

## Membership and 14-day trial

Use the actual `userId` from a signed-in platform `/.auth/me` response, not an email supplied in a form. The API also requires an approved private membership:

```json
{"VERIFIED_SWA_USER_ID":{"tenantId":"produce-company","organization":"Verified organization","roles":["operator"],"trialEndsAt":"2026-12-02T10:00:00.000Z"}}
```

Valid roles: `admin`, `operator`, `reviewer`, read-only `viewer`. Organization slugs contain 3–48 lower-case letters, numbers, or hyphens. Trial expiry is checked on each organization request. Generate a fresh 14-day entry with:

```sh
node scripts/trial-member.mjs VERIFIED_SWA_USER_ID produce-company "Verified organization"
```

This prints an entry; it does not grant access. Merge only verified memberships into the private Key Vault secret. References may need an application restart or refresh after updates. Public demo credentials and `?demo=1` never authorize the API.

## Enquiries and model processing

The activated free-form form posts to same-origin `/api/enquiries`. A receipt confirms storage, not a meeting or trial. There is no calendar or email notification. A configured owner can retrieve the latest 100 requests at `GET /api/enquiries`; ordinary organization administrators cannot. Publish the actual company and a private contact channel before receiving confidential material.

Azure OpenAI receives authorized text and optional JPEG/PNG/WebP evidence. Structured findings cite supplied references; the adapter verifies text quotations. Images still require qualified review. Archives keep source text and metadata, not uploaded image bytes.

Set the workflow variable `AZURE_DOCUMENT_INTELLIGENCE_ACCOUNT_NAME` to an existing Document Intelligence resource in the same resource group with a custom HTTPS subdomain. The template configures its endpoint and assigns the API identity the Cognitive Services User role. When enabled, members can attach one dispatch or handover PDF up to 2 MB. The Read model extracts the first ten pages. The brief retains the source reference and extracted text, and reports the number of pages read. Uploaded PDF bytes are not included in the archive. See [Microsoft’s Document Intelligence Read documentation](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/concept-read).

The optional `api/sector-vision.mjs` adapter requires an evaluated model at `COLDLINE_VISION_ENDPOINT`. Set `COLDLINE_INFERENCE_HOST` for an explicitly allowed AKS host; Azure ML inference hosts are recognized. A custom audience also needs API setting `COLDLINE_INFERENCE_SCOPE`. Grant the API identity invocation access; AKS ingress must validate that identity. Request/response contract:

```json
{"images":[{"source":"I1","image":"data:image/jpeg;base64,..."}]}
```

```json
{"observations":[{"source":"I1","observation":"A bounded visible observation."}]}
```

The adapter validates references and adds labelled observations to the review evidence. It requires a purpose-trained or evaluated model supplied by the operator. IoT ingestion and source-system pipelines remain separate integration work.

`infra/gpu-workers.bicep` defines optional AKS capacity, Entra RBAC, workload identity, and a GPU pool scaling from zero. It still needs approved quota, a compatible device plugin, an evaluated model image, secure inference ingress, and load tests. Its system pool costs money even with zero GPU nodes.

## Operations and limits

Tenant data uses separate `tenant-<organization>` containers and conditional writes. Record changes, report completion, and acceptance keep their audit event in the same state write. A five-minute timer retries archival; the API exposes no audit update/delete operation.

The audit container has a 365-day retention policy. Review and explicitly lock it through Azure before claiming immutable production retention. Locking has real retention consequences and is never automatic. Versioning and seven-day soft delete do not replace recovery tests.

Optional private networking creates Blob/API-vault private endpoints with outbound Functions VNet integration. Functions ingress stays reachable by SWA and protected by its linked authentication provider. Frontend auth secrets use a separate RBAC vault because SWA cannot join that private data network. Host storage is separate from tenant storage. Private OpenAI endpoints and customer-managed encryption keys require separately configured organization network/key policies and identity access; the default template does not activate them.

Application Insights records request IDs, routes, methods, statuses, and durations without evidence or form payloads. Reports retain actual model tokens and latency. Usage explicitly covers the latest 50 reports. This implementation caps each register at 2,000 records and uses one workspace ETag; move to indexed/per-record/queued storage after measured volume or write conflicts justify it. No high-throughput benchmark is claimed.

`infra/defender.bicep` enables paid subscription-wide storage/container plans only when separately deployed. Configure alert ownership, access reviews, model evaluation, recovery tests, and real availability monitoring. The 99.9% objective is a target, not measured uptime or a contractual SLA.

Update public company and metric fields in `assets/site-config.js` only with verified facts and source-backed measurements. A website build cannot create customers, registrations, founder history, paid subscriptions, or uptime evidence.

## Official references

- [Bring-your-own Functions security boundary](https://learn.microsoft.com/en-us/azure/static-web-apps/functions-bring-your-own)
- [SWA managed-identity limits](https://learn.microsoft.com/en-us/azure/static-web-apps/faq)
- [Tenant-restricted custom authentication](https://learn.microsoft.com/en-us/azure/static-web-apps/authentication-custom)
- [Frontend authentication secrets in Key Vault](https://learn.microsoft.com/en-us/azure/static-web-apps/key-vault-secrets)
