# Coldline

Shipment review software for produce exporters, cold stores, and logistics teams. Connect photographs, temperature evidence, and an operator’s next action. A condition warning supports inspection; it does not certify food safety or authorize release.

[Published website](https://uniqkode.github.io/coldline/) · [Deployment guide](deployment/README.md) · [Brief coverage](deployment/brief-coverage.md)

## Website

24 responsive HTML pages include all eight routes in the brief. The homepage has 13 content sections plus its footer, in the specified order. Inter, white, slate, and blue form the shared design system. Scroll reveals respect reduced motion.

Sign up opens Contact with a 14-day trial request selected. Homepage and Contact use free-form requests; there is no Calendly. Public GitHub Pages prepares a downloadable draft and optional public GitHub enquiry preview. In an activated Azure runtime, the same form sends to a private API and shows a receipt only after storage succeeds.

Proposed USD packages: Starter $499/month for 500 checks and five operators; Growth $1,499/month for 2,500 checks and 15 operators; Enterprise by agreement. Overage is $1.20/$0.80 respectively. Annual pricing is 20% lower. Packages do not establish payment collection, a customer contract, or paying customers.

## Run and verify

```sh
npm run dev
npm test
npm run check
npm run build:azure
```

Static preview: `http://127.0.0.1:4173/`. No dependency install is needed for the website or native Node tests. Azure targets Node 22. The build separates static files (`dist/site`) from API code and dependency manifests (`dist/backend`).

## Public workspace

Choose the one-click demo or use `demo@coldline.example` / `MVPdemo2026!`. These are public sample credentials; they grant no organization access.

The workspace includes a priority queue, status filters, shipment registration, operator notes, handover/reopen actions, search, sorting, CSV export, citations, prepared analyses, and report downloads. Demo records and accepted sample reports stay in this browser. Prepared analysis makes no model request.

## Organization runtime

The optional Azure API implements Entra platform identity plus server-side membership, roles, and trial expiry; separate tenant Blob containers; conditional record writes; connected Azure OpenAI analysis with checked text citations; an optional configured Azure ML/AKS vision adapter; private enquiries with owner-only retrieval; and durable audit events with archival retries. Reports record actual tokens and latency. Usage explicitly covers the latest 50 reports, not all-time customer traction.

Production registers start empty and never load demo fixtures. Browser flags and query parameters grant no API access. The deployment verifies linked Static Web Apps authentication before enabling the HTTP function. No trained sector model is bundled.

The standalone `npm run api` adapter remains available for authorized test evidence with separate server configuration in `.env.azure.example`.

## Infrastructure and actual operating facts

`infra/main.bicep` defines SWA Standard, Premium Functions, storage, Key Vault, identities/roles, monitoring, and audit retention. Optional private networking, GPU capacity, and Defender templates are included. A Git push never provisions paid Azure resources. Activation requires an actual subscription, deployment identity, Entra app, memberships, and compatible model.

Public facts live in `assets/site-config.js`. Unverified legal identity, RC, headquarters, LinkedIn, contact email, customer metrics, and measured uptime remain unpublished. The real maintainer is Precious Arinze / Uniqkode; no extra founders or credentials are invented.

The workload scenario is 55 hypothetical organizations × 120 shipments × 24 checkpoints × four image/record items: 158,400 checkpoints and 633,600 input items monthly. It is not usage evidence.

Image credits are in `assets/image-sources.json` and `assets/editorial-sources.json`. Locally hosted Inter uses the SIL Open Font License in `assets/INTER-LICENSE.txt`; legacy font licenses remain in `assets/FONT-LICENSES.txt`.
