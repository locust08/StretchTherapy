import fs from 'node:fs';
import path from 'node:path';

const distDir = path.join(process.cwd(), 'dist');

function readDist(route) {
  const filePath = route === '/'
    ? path.join(distDir, 'index.html')
    : path.join(distDir, route.replace(/^\/+|\/+$/g, ''), 'index.html');

  return fs.readFileSync(filePath, 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const home = readDist('/');
const contact = readDist('/contact');
const join = readDist('/join');

assert(home.includes('GTM-5F3MLDMN'), 'Expected GTM container ID in built homepage.');
assert(home.includes('googletagmanager.com/gtm.js'), 'Expected GTM loader in built homepage.');
assert(home.includes('window.dataLayer'), 'Expected dataLayer initialization.');
assert(home.includes('whatsapp_click'), 'Expected WhatsApp event tracking code.');
assert(home.includes('facebook_click'), 'Expected Facebook event tracking code.');
assert(home.includes('instagram_click'), 'Expected Instagram event tracking code.');
assert(home.includes('google_maps_click'), 'Expected Google Maps event tracking code.');
assert(home.includes('lead_form_submit'), 'Expected lead form submit tracking code.');
assert(home.includes('contentDocument'), 'Expected same-origin iframe tracking support.');
assert(home.includes('gtag('), 'Expected direct GA4 fallback support.');

assert(contact.includes('/reference/contact/index.html'), 'Expected contact page to keep existing iframe route.');
assert(join.includes('forms.zohopublic.com'), 'Expected /join to keep the Zoho iframe.');
assert(!join.includes('GOOGLE_OAUTH_CLIENT_SECRET'), 'OAuth secrets must never be in client output.');
assert(!join.includes('GOOGLE_OAUTH_REFRESH_TOKEN'), 'OAuth refresh token must never be in client output.');
assert(!home.includes('GOOGLE_API_KEY'), 'Google API key env name must not be leaked into client output.');

console.log('Analytics verification passed.');
