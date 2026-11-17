# Coldline

AI reviews produce images and temperature histories to flag shipments at risk.

For fresh-produce exporters, cold stores and logistics operators. Coldline checks pallet images and changing temperature records, then explains which shipment needs a cold-chain intervention.

## Product workflow

- Buyer: Produce exporters & cold-chain operators
- Input: Pallet images and shipment temperature histories
- AI output: A condition warning with the affected pallet and reason
- Human action: Assign a cold-chain check

The warning supports an inspection. It does not certify food safety or replace a qualified quality decision.

## Design

**Cold-chain journey.** Route opening → three checkpoint photographs → excursion timeline → condition brief → logistics architecture → checkpoint roadmap.

Heading: Space Grotesk. Body: Manrope. Accent: #136f99.

Logo: A squared C encloses a temperature line; the open edge represents goods moving through.

The standalone site contains 24 routed pages (including home/technology aliases) plus its 404 page. Problem, solution, market and combined legal pages join the team, contact, roadmap and policy pages. Three industry photographs are included locally. Source, author, license and modification details are in `assets/image-sources.json`, `assets/editorial-sources.json` and Terms & credits. Font licenses are in `assets/FONT-LICENSES.txt`.

## Try the workspace

Serve this folder using any static HTTP server, for example `python3 -m http.server 8080`, then open http://localhost:8080/. No dependency installation or build step is needed for this standalone output. Use `demo@coldline.example` and `MVPdemo2026!`, or the one-click sample workspace. This is public demo access, not production authentication.

Choose a prepared case, run the review, open a citation, retain the report for human review and download it. Operational records support creation, notes, status changes, search, filters, sorting and CSV export. Prepared runs make no model request.

## Azure architecture

- [Azure IoT Hub](https://learn.microsoft.com/en-us/azure/iot-hub/iot-concepts-and-iot-hub): Receive shipment temperature readings and equipment events from authorized devices. **Planned integration.**
- [Azure Machine Learning](https://learn.microsoft.com/en-us/azure/machine-learning/concept-endpoints-batch?view=azureml-api-2): Evaluate changes in produce images alongside the shipment’s temperature history. **Planned integration.**
- [Azure OpenAI in Microsoft Foundry](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/responses): Explain the condition warning and identify the evidence the receiving operator should check. **Connector implemented · configure Azure deployment.**
- [Azure Blob Storage](https://learn.microsoft.com/en-us/azure/storage/blobs/storage-blobs-overview): Keep checkpoint images and quality review records attached to the shipment. **Planned integration.**

The repository includes the optional [server-side Azure OpenAI and OpenAI adapter](https://github.com/Uniqkode/b2b-product-studio/blob/main/server/README.md). Azure use requires a deployed compatible model, resource endpoint and server credentials. No Azure resource is connected by the public static site. GitHub Pages cannot execute the server or keep a secret.

## Development roadmap

- **01. Product foundation — Built:** Website, review workspace, source citations, report retention, operational register and downloads are implemented.
- **02. Azure model connection — Ready to configure:** Azure OpenAI connector code and configuration checks are implemented. A deployed model, endpoint and server-side credentials are still required.
- **03. Sector data integration — Planned:** Connect temperature devices, shipment references and checkpoint image capture.
- **04. Reviewed field pilot — Planned:** Compare warnings with quality inspections at handover; calibrate thresholds for each produce category.
- **05. Production operations — Planned:** Implement verified accounts, organization access, audit history, retention controls, monitoring and measured capacity limits before commercial operation.

## Workload planning

55 hypothetical organizations × 120 active shipments per operator × 24 checks per shipment / month × 4 images and records per check = **633,600 condition checks per month**.

The same load is checked at multiple points. The value comes from combining visual condition with its changing storage and transport history.

These assumptions do not establish actual customers, Azure consumption or model accuracy.

## Company details and contact

The team page identifies the public repository maintainer, Precious Arinze / Uniqkode, with a short implementation bio. The enquiry form prepares a message for review and final submission on GitHub, or through a verified email when configured. A separate local project brief can be saved and downloaded.

Legal names and RC numbers are managed in `src/company-profiles.json` in the complete repository. Registration is unpublished unless the record has `registrationVerified: true`, a genuine legal name and RC number, and an evidence reference. Do not use placeholder registrations in applications.

## Current scope

Prepared operational cases use sample data. Browser-local edits and reports are not shared between users. Connected analysis sends entered material only when explicitly run. Shared accounts, sector ingestion, OCR, trained vision/forecast models, retention and production monitoring remain work described by the roadmap.

## Interactive product tools

Inspect a temperature exception. Set the recorded temperature, review threshold and duration. The comparison flags a review question; it does not certify food safety.

The value planner compares your own review-time assumptions and exports the plan. Buyer tabs explain the segments, the solution tour steps through the workflow, and infrastructure tabs explain each service’s job. The homepage also includes a product-specific Why now, outcome measures, market strategy, software progress and three commercial plan tiers.

## Independent AI service and deployment

This kit includes its own `service/ai-service.mjs`, product definition and provider configuration. With Node 20+, run `npm run api` from this kit after configuring server-side provider credentials. The adapter accepts only Coldline requests. See `deployment/README.md` for the Azure Static Web Apps workflow and custom-domain setup; the model service deploys separately.

Company, domain, contact and booking fields are controlled in the complete repository’s [OWNER_SETUP.md](OWNER_SETUP.md). Unverified values remain unpublished.

## Dedicated repository

Prepared destination: `Uniqkode/coldline`. The homepage and assets are at the repository root. The optional Node model adapter is in `service/`; Azure deployment instructions are in `deployment/`.
