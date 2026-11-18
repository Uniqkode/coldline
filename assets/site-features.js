(() => {
  'use strict';
  const site = window.COLDLINE_SITE;
  if (!site) return;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const base = document.body.dataset.base || './';
  const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 }).format(value);
  const requested = new URLSearchParams(location.search).get('intent');
  const requests = { trial: '14-day trial', demo: 'Product demo', enterprise: 'Enterprise onboarding', signup: '14-day trial' };

  $$('[data-freeform-form]').forEach(form => {
    const kind = form.elements.requestType;
    if (requests[requested] && kind) kind.value = requests[requested];
    const result = $('[data-request-result]', form);
    const status = $('[data-request-status]', form);
    const button = $('[type="submit"]', form);
    let draft = '';
    if (site.runtime.enabled && site.runtime.origin === location.origin) {
      button.textContent = 'Send my request';
      $$('[data-request-public], [data-request-public-notice]', form).forEach(node => { node.hidden = true; });
    }
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const data = Object.fromEntries(new FormData(form));
      delete data.consent;
      Object.keys(data).forEach(key => { data[key] = String(data[key]).trim(); });
      draft = `COLDLINE — ${data.requestType.toUpperCase()}\n\nName: ${data.name}\nWork email: ${data.email}\nOrganization: ${data.organization}\nPlan: ${data.plan || 'To discuss'}\nPreferred time: ${data.preferredTime || 'To arrange'}\n\n${data.message}\n\nA requested time is not a confirmed appointment. Trial access begins after onboarding approval.\n`;
      result.hidden = false;
      if (site.runtime.enabled && site.runtime.origin === location.origin) {
        button.disabled = true;
        status.textContent = 'Sending your request…';
        try {
          const response = await fetch('/api/enquiries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
          const body = await response.json();
          if (!response.ok) throw new Error(body.error || 'Your request could not be delivered.');
          status.textContent = `Request received. Reference ${body.reference}. A booking or trial is confirmed separately.`;
        } catch (error) {
          status.textContent = `${error.message} Your completed request is still available to download.`;
        } finally { button.disabled = false; }
      } else {
        status.textContent = 'Your request is prepared. Download it, or review a public project enquiry below. This page has not sent a message.';
      }
      const publicLink = $('[data-request-public]', form);
      if (publicLink) {
        const url = new URL('https://github.com/Uniqkode/coldline/issues/new');
        url.searchParams.set('title', `Coldline ${data.requestType.toLowerCase()} request`);
        url.searchParams.set('body', `Request: ${data.requestType}\nPlan: ${data.plan || 'To discuss'}\n\n${data.message}\n\nPlease arrange contact privately. Contact name and work email are excluded from this public draft.`);
        publicLink.href = url.href;
      }
      const emailLink = $('[data-request-email]', form);
      if (emailLink && site.company.contactEmail) {
        emailLink.hidden = false;
        emailLink.href = `mailto:${site.company.contactEmail}?subject=${encodeURIComponent(`Coldline ${data.requestType}`)}&body=${encodeURIComponent(draft)}`;
      }
    });
    $('[data-request-download]', form)?.addEventListener('click', () => {
      if (!draft) return;
      const url = URL.createObjectURL(new Blob([draft], { type: 'text/plain;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url; link.download = 'coldline-request.txt'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  });

  $$('[data-corporate-facts]').forEach(root => {
    const company = site.company;
    const facts = [company.legalName, company.registrationNumber && `Registration: ${company.registrationNumber}`, company.headquarters && `Headquarters: ${company.headquarters}`].filter(Boolean);
    root.textContent = facts.join(' · ');
    root.hidden = !facts.length;
  });
  $$('[data-company-name]').forEach(node => { node.textContent = site.company.legalName || site.company.brand; });
  $$('[data-company-field]').forEach(node => { node.textContent = site.company[node.dataset.companyField] || 'Not published'; });
  $$('[data-company-linkedin]').forEach(node => {
    if (site.company.linkedin && /^https:\/\/(www\.)?linkedin\.com\//.test(site.company.linkedin)) { node.href = site.company.linkedin; node.hidden = false; }
  });
  $$('[data-plan-preview]').forEach(node => {
    const plan = site.pricing.plans.find(plan => plan.id === node.dataset.planPreview);
    if (plan?.monthly) node.textContent = money(plan.monthly);
  });

  const metrics = site.publicMetrics;
  if (metrics && metrics.source && metrics.measuredAt && Number.isFinite(Date.parse(metrics.measuredAt))) {
    const values = { teams: metrics.activeOrganizations, checks: metrics.conditionChecksLast30Days, latency: metrics.averageLatencySeconds, storage: metrics.storageGB };
    Object.entries(values).forEach(([key, value]) => {
      if (Number.isFinite(value) && value >= 0) $$(`[data-public-metric="${key}"]`).forEach(node => { node.textContent = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value); });
    });
    $$('[data-metrics-source]').forEach(node => {
      try { const url = new URL(metrics.source); if (url.protocol !== 'https:') return; node.href = url.href; node.hidden = false; node.textContent = `Usage source · ${new Date(metrics.measuredAt).toLocaleDateString('en-GB')}`; } catch {}
    });
    $$('[data-metrics-scope]').forEach(node => { node.textContent = 'Reported operational measurements. See the source and reporting date.'; });
  }

  if (site.runtime.enabled && site.runtime.origin) {
    try {
      const origin = new URL(site.runtime.origin);
      if (origin.protocol !== 'https:') return;
      $$('[data-production-login]').forEach(link => { link.href = `${origin.origin}/.auth/login/aad?post_login_redirect_uri=/dashboard/`; link.hidden = false; });
      $$('[data-runtime-scope]').forEach(node => { node.textContent = 'Organization accounts use Microsoft Entra ID. Access depends on your organization membership and role.'; });
    } catch {}
  }
})();
