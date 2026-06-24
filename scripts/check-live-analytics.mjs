const productionUrl = 'https://stretchtherapy.sitetarik.com/';
const expectedGtmId = 'GTM-5F3MLDMN';

const checks = [
  {
    url: productionUrl,
    required: [expectedGtmId, 'googletagmanager.com/gtm.js', 'window.dataLayer'],
  },
  {
    url: new URL('/contact/', productionUrl).href,
    required: [expectedGtmId, 'whatsapp_click', 'facebook_click', 'instagram_click'],
  },
  {
    url: new URL('/join/', productionUrl).href,
    required: [expectedGtmId, 'forms.zohopublic.com'],
  },
];

for (const check of checks) {
  const response = await fetch(check.url, { cache: 'no-store' });
  const html = await response.text();

  for (const token of check.required) {
    if (!html.includes(token)) {
      throw new Error(`${check.url} is missing ${token}`);
    }
  }
}

console.log('Live analytics verification passed.');
