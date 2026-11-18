(() => {
  'use strict';
  const site = window.COLDLINE_SITE;
  if (!site) return;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 }).format(value);
  const query = new URLSearchParams(location.search);
  const requests = { trial: '14-day trial', demo: 'Product demo', enterprise: 'Enterprise onboarding', signup: '14-day trial' };
  const privateEnquiries = site.runtime.enabled && site.runtime.origin === location.origin;

  $$('[data-freeform-form]').forEach(form => {
    const requested = query.get('intent');
    if (Object.hasOwn(requests, requested)) form.elements.requestType.value = requests[requested];
    const plan = [...form.elements.plan.options].find(option => option.dataset.plan === query.get('plan'));
    if (plan) form.elements.plan.value = plan.value;
    const result = $('[data-request-result]', form);
    const status = $('[data-request-status]', form);
    const button = $('[type="submit"]', form);
    let draft = '';
    if (privateEnquiries) {
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
      if (privateEnquiries) {
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
        status.textContent = 'Your draft is ready to download. You can also open a public GitHub enquiry and add a short summary there.';
      }
      const publicLink = $('[data-request-public]', form);
      if (publicLink && !privateEnquiries) {
        const url = new URL('https://github.com/Uniqkode/coldline/issues/new');
        const category = [...form.elements.requestType.options].map(option => option.value).includes(data.requestType) ? data.requestType : 'Product enquiry';
        url.searchParams.set('title', `Coldline ${category.toLowerCase()} request`);
        url.searchParams.set('body', 'Briefly describe what you would like to discuss. GitHub issues are public. Please omit personal details and confidential information.');
        publicLink.href = url.href;
      }
      const emailLink = $('[data-request-email]', form);
      if (emailLink && site.company.contactEmail) {
        emailLink.hidden = false;
        emailLink.href = `mailto:${site.company.contactEmail}?subject=${encodeURIComponent(`Coldline ${data.requestType}`)}&body=${encodeURIComponent(draft)}`;
      }
    });
    button.disabled = false;
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
  $$('[data-company-field]').forEach(node => {
    const value = site.company[node.dataset.companyField];
    if (typeof value !== 'string' || !value.trim()) return;
    node.textContent = value;
    node.parentElement.hidden = false;
  });
  $$('[data-company-linkedin]').forEach(node => {
    if (site.company.linkedin && /^https:\/\/(www\.)?linkedin\.com\//.test(site.company.linkedin)) { node.href = site.company.linkedin; node.hidden = false; }
  });
  $$('[data-plan-preview]').forEach(node => {
    const plan = site.pricing.plans.find(plan => plan.id === node.dataset.planPreview);
    if (plan?.monthly) node.textContent = money(plan.monthly);
  });

  function measurementSource(measurement) {
    if (!measurement?.source || !Number.isFinite(Date.parse(measurement.measuredAt))) return null;
    try {
      const source = new URL(measurement.source);
      return source.protocol === 'https:' && !source.username && !source.password ? source.href : null;
    } catch { return null; }
  }
  const measurementDate = measurement => new Date(measurement.measuredAt).toLocaleDateString('en-GB', { timeZone: 'Africa/Lagos' });
  const metrics = site.publicMetrics;
  const source = measurementSource(metrics);
  if (source) {
    const values = { teams: metrics.activeOrganizations, checks: metrics.conditionChecksLast30Days, latency: metrics.averageLatencySeconds, storage: metrics.storageGB };
    let shown = false;
    Object.entries(values).forEach(([key, value]) => {
      if (!Number.isFinite(value) || value < 0) return;
      $$(`[data-public-metric="${key}"]`).forEach(node => {
        node.textContent = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value);
        node.parentElement.hidden = false;
        shown = true;
      });
    });
    if (shown) {
      $$('[data-metrics-grid]').forEach(node => { node.hidden = false; });
      $$('[data-metrics-source]').forEach(node => {
        node.href = source;
        node.hidden = false;
        node.textContent = `Usage source · ${measurementDate(metrics)}`;
      });
      $$('[data-metrics-scope]').forEach(node => { node.textContent = 'Reported operational measurements for the period shown in the source.'; });
    }
  }
  const availability = site.availability;
  const availabilitySource = measurementSource(availability);
  if (availabilitySource && Number.isFinite(availability.measuredPercent) && availability.measuredPercent >= 0 && availability.measuredPercent <= 100) {
    $$('[data-availability-measurement]').forEach(node => {
      node.href = availabilitySource;
      node.textContent = `${availability.measuredPercent}% measured availability · ${measurementDate(availability)}`;
      node.hidden = false;
    });
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
