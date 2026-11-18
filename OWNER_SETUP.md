# Coldline owner setup

The public website runs the sample workspace and prepares demo and trial enquiries. The [Azure deployment guide](deployment/README.md) covers the private organization workspace and enquiry API.

## Company and public measurements

Update [the public configuration](assets/site-config.js) with facts approved for publication. It is served to browsers, so keep private data and credentials in the Azure deployment environment.

| Field | What to supply |
| --- | --- |
| company.legalName, registrationNumber, headquarters | The registered operator, its registration number, and headquarters city |
| company.linkedin | The official company profile |
| company.contactEmail | A monitored public mailbox authorized to receive requests |
| publicMetrics | Actual reporting date, public HTTPS source, active organizations, 30-day check count, average analysis seconds, and stored evidence in GB |
| availability | Measured uptime percentage, reporting date, and public HTTPS source with the measurement period |

Publish additional team profiles on the homepage and Team page once names, roles, and professional links have been verified. The site already identifies the public project maintainer. Pricing specifies proposed plan allowances. The workload calculator shows the capacity assumptions separately from reported usage.

## Freeform requests and access

Sign up opens Contact with the trial request selected. Plan links also select the relevant tier. On GitHub Pages, visitors can download the completed draft, use an approved email address if configured, or open a generic public GitHub enquiry. Form entries stay in the draft until the visitor chooses to share them.

On Azure, the same form stores enquiries privately and returns a receipt. Organization membership and trial dates are granted during onboarding. Set up the deployment and access using the [Azure deployment guide](deployment/README.md).
