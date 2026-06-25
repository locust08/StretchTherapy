const GTM_ACCOUNT_ID = '6346744109';
const GTM_PUBLIC_ID = 'GTM-5F3MLDMN';
const GTM_CONTAINER_NAME = 'SiteTarik';
const VERSION_NAME = 'Stretch Therapy tracking events';

const EVENTS = [
  'stretchtherapy_whatsapp_click',
  'stretchtherapy_facebook_click',
  'stretchtherapy_instagram_click',
  'stretchtherapy_google_maps_click',
  'stretchtherapy_lead_form_submit',
];

const dataLayerEventNameFor = (eventName) => `gtm_${eventName}`;

const {
  GOOGLE_OAUTH_CLIENT_ID,
  GOOGLE_OAUTH_CLIENT_SECRET,
  GOOGLE_OAUTH_REFRESH_TOKEN,
  GOOGLE_WORKSPACE_OAUTH_REFRESH_TOKEN,
} = process.env;

if (!GOOGLE_OAUTH_CLIENT_ID || !GOOGLE_OAUTH_CLIENT_SECRET) {
  throw new Error('Missing Google OAuth client credentials.');
}

const refreshToken = GOOGLE_WORKSPACE_OAUTH_REFRESH_TOKEN || GOOGLE_OAUTH_REFRESH_TOKEN;

if (!refreshToken) {
  throw new Error('Missing Google OAuth refresh token.');
}

const api = async (path, { method = 'GET', body, headers = {} } = {}) => {
  const response = await fetch(`https://tagmanager.googleapis.com/tagmanager/v2/${path}`, {
    method,
    headers: {
      authorization: `Bearer ${globalThis.accessToken}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${method} ${path} failed: ${response.status} ${JSON.stringify(json)}`);
  }
  return json;
};

const getAccessToken = async () => {
  const body = new URLSearchParams({
    client_id: GOOGLE_OAUTH_CLIENT_ID,
    client_secret: GOOGLE_OAUTH_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(`Token request failed: ${response.status} ${JSON.stringify(json)}`);
  }
  return json.access_token;
};

const customEventTrigger = (eventName) => ({
  name: `Event - ${dataLayerEventNameFor(eventName)}`,
  type: 'customEvent',
  customEventFilter: [
    {
      type: 'equals',
      parameter: [
        { type: 'template', key: 'arg0', value: '{{_event}}' },
        { type: 'template', key: 'arg1', value: dataLayerEventNameFor(eventName) },
      ],
    },
  ],
});

const eventHtml = (eventName) => `<script>
(function() {
  if (typeof window.gtag !== 'function') {
    return;
  }
  window.__stretchTherapyGtmEventLocks = window.__stretchTherapyGtmEventLocks || {};
  if (window.__stretchTherapyGtmEventLocks['${eventName}']) {
    return;
  }
  window.__stretchTherapyGtmEventLocks['${eventName}'] = true;

  var gtm = window.google_tag_manager && window.google_tag_manager['${GTM_PUBLIC_ID}'];
  var dataLayerApi = gtm && gtm.dataLayer;
  function readValue(key) {
    return dataLayerApi && typeof dataLayerApi.get === 'function' ? (dataLayerApi.get(key) || '') : '';
  }
  window.gtag('event', '${eventName}', {
    event_category: readValue('event_category') || 'stretchtherapy',
    event_action: readValue('event_action') || '${eventName.replace(/^stretchtherapy_/, '')}',
    link_url: readValue('link_url'),
    link_text: readValue('link_text'),
    page_location: readValue('page_location') || window.location.href,
    form_provider: readValue('form_provider'),
    form_context: readValue('form_context'),
    outbound: ${eventName.includes('_click') ? 'true' : 'false'}
  });
  window.setTimeout(function() {
    window.__stretchTherapyGtmEventLocks['${eventName}'] = false;
  }, 1000);
})();
</script>`;

const customHtmlTag = (eventName, triggerId) => ({
  name: `GA4 Event - ${eventName}`,
  type: 'html',
  parameter: [
    { type: 'template', key: 'html', value: eventHtml(eventName) },
    { type: 'boolean', key: 'supportDocumentWrite', value: 'false' },
  ],
  firingTriggerId: [triggerId],
});

const main = async () => {
  globalThis.accessToken = await getAccessToken();

  const accounts = await api('accounts');
  const account = accounts.account?.find((item) => item.accountId === GTM_ACCOUNT_ID);
  if (!account) throw new Error(`Cannot find account ${GTM_ACCOUNT_ID}.`);

  const containers = await api(`${account.path}/containers`);
  const container = containers.container?.find((item) => item.publicId === GTM_PUBLIC_ID);
  if (!container) throw new Error(`Cannot find container ${GTM_PUBLIC_ID}.`);
  if (container.name !== GTM_CONTAINER_NAME) {
    throw new Error(`Unexpected container name: ${container.name}`);
  }

  const workspaces = await api(`${container.path}/workspaces`);
  const workspace = workspaces.workspace?.find((item) => item.name === 'Default Workspace') ||
    workspaces.workspace?.[0];
  if (!workspace) throw new Error('Cannot find a GTM workspace.');

  const existingTriggers = (await api(`${workspace.path}/triggers`)).trigger || [];
  const existingTags = (await api(`${workspace.path}/tags`)).tag || [];
  const created = [];
  const reused = [];
  const updated = [];

  for (const eventName of EVENTS) {
    const oldTriggerName = `Event - ${eventName}`;
    const triggerName = `Event - ${dataLayerEventNameFor(eventName)}`;
    let trigger = existingTriggers.find((item) => item.name === triggerName);
    if (!trigger) {
      trigger = existingTriggers.find((item) => item.name === oldTriggerName);
    }
    if (!trigger) {
      trigger = await api(`${workspace.path}/triggers`, {
        method: 'POST',
        body: customEventTrigger(eventName),
      });
      created.push(trigger.name);
    } else {
      const updatedTrigger = await api(`${workspace.path}/triggers/${trigger.triggerId}`, {
        method: 'PUT',
        body: {
          ...customEventTrigger(eventName),
          triggerId: trigger.triggerId,
          fingerprint: trigger.fingerprint,
        },
      });
      reused.push(updatedTrigger.name);
      trigger = updatedTrigger;
    }

    const tagName = `GA4 Event - ${eventName}`;
    let tag = existingTags.find((item) => item.name === tagName);
    if (!tag) {
      tag = await api(`${workspace.path}/tags`, {
        method: 'POST',
        body: customHtmlTag(eventName, trigger.triggerId),
      });
      created.push(tag.name);
    } else {
      const updatedTag = await api(`${workspace.path}/tags/${tag.tagId}`, {
        method: 'PUT',
        body: {
          ...customHtmlTag(eventName, trigger.triggerId),
          tagId: tag.tagId,
          fingerprint: tag.fingerprint,
        },
      });
      updated.push(updatedTag.name);
    }
  }

  const version = await api(`${workspace.path}:create_version`, {
    method: 'POST',
    body: {
      name: VERSION_NAME,
      notes: `Add GA4 custom event tracking for ${EVENTS.join(', ')}.`,
    },
  });

  const publish = await api(`${container.path}/versions/${version.containerVersion.containerVersionId}:publish`, {
    method: 'POST',
  });

  const refreshedTriggers = (await api(`${workspace.path}/triggers`)).trigger || [];
  const refreshedTags = (await api(`${workspace.path}/tags`)).tag || [];

  console.log(JSON.stringify({
    account: { accountId: account.accountId, name: account.name },
    container: { containerId: container.containerId, publicId: container.publicId, name: container.name },
    workspace: { workspaceId: workspace.workspaceId, name: workspace.name },
    created,
    reused,
    updated,
    publishedVersionId: version.containerVersion.containerVersionId,
    compilerError: publish.compilerError || false,
    liveTriggers: refreshedTriggers
      .filter((item) => EVENTS.includes(item.name.replace(/^Event - gtm_/, '')))
      .map((item) => ({ name: item.name, triggerId: item.triggerId, customEventFilter: item.customEventFilter })),
    liveTags: refreshedTags
      .filter((item) => EVENTS.includes(item.name.replace(/^GA4 Event - /, '')))
      .map((item) => ({ name: item.name, tagId: item.tagId, firingTriggerId: item.firingTriggerId })),
  }, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
