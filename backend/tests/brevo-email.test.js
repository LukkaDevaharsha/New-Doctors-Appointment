const test = require('node:test');
const assert = require('node:assert/strict');
process.env.NODE_ENV = 'test';
process.env.EMAIL_MODE = 'brevo';
process.env.BREVO_API_KEY = 'test-api-key-never-log';
process.env.BREVO_SENDER_EMAIL = 'clinic@example.test';
process.env.BREVO_SENDER_NAME = 'Doctors Appointment';
process.env.FRONTEND_ORIGIN = 'https://app.example.test';
const { sendTransactionalEmail, sendVerificationEmail, setBrevoFetchForTests, validateEmailConfiguration } = require('../services/email');

test('Brevo sends a transactional email with the expected endpoint, headers and sender', async () => {
  let request;
  setBrevoFetchForTests(async (url, options) => {
    request = { url, options };
    return { ok: true, status: 201 };
  });
  assert.deepEqual(await sendTransactionalEmail({ email: 'person@example.test', subject: 'Hello', text: 'Text', html: '<p>Text</p>' }), { success: true });
  assert.equal(request.url, 'https://api.brevo.com/v3/smtp/email');
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.headers['api-key'], process.env.BREVO_API_KEY);
  assert.equal(request.options.headers['Content-Type'], 'application/json');
  const body = JSON.parse(request.options.body);
  assert.deepEqual(body.sender, { email: 'clinic@example.test', name: 'Doctors Appointment' });
  assert.deepEqual(body.to, [{ email: 'person@example.test' }]);
});

test('invalid Brevo credentials report a safe authentication failure', async () => {
  setBrevoFetchForTests(async () => ({ ok: false, status: 401 }));
  await assert.rejects(sendTransactionalEmail({ email: 'person@example.test', subject: 'Hello', text: 'Text' }), (error) => {
    assert.equal(error.code, 'BREVO_AUTH');
    assert.equal(JSON.stringify(error).includes(process.env.BREVO_API_KEY), false);
    return true;
  });
});

test('Brevo rate limits and network failures are surfaced without response content', async () => {
  setBrevoFetchForTests(async () => ({ ok: false, status: 429, text: async () => 'private content' }));
  await assert.rejects(sendTransactionalEmail({ email: 'person@example.test', subject: 'Hello', text: 'Text' }), { code: 'BREVO_RATE_LIMIT' });
  setBrevoFetchForTests(async () => { throw new Error('network detail'); });
  await assert.rejects(sendTransactionalEmail({ email: 'person@example.test', subject: 'Hello', text: 'Text' }), { code: 'NETWORK_ERROR' });
});

test('verification email includes escaped greeting, existing frontend link and expiry details', async () => {
  let payload;
  setBrevoFetchForTests(async (_url, options) => { payload = JSON.parse(options.body); return { ok: true, status: 201 }; });
  await sendVerificationEmail('person@example.test', 'a'.repeat(64), '<Patient>');
  assert.match(payload.htmlContent, /&lt;Patient&gt;/);
  assert.match(payload.htmlContent, /Verify email address/);
  assert.match(payload.htmlContent, /expires in <strong>24 hours/);
  assert.match(payload.htmlContent, /ignore this email/);
  assert.match(payload.textContent, /https:\/\/app\.example\.test\/verify-email\?token=/);
});

test('production-style startup requires all Brevo configuration', () => {
  const old = process.env.BREVO_API_KEY;
  delete process.env.BREVO_API_KEY;
  assert.throws(validateEmailConfiguration, { code: 'BREVO_CONFIG' });
  process.env.BREVO_API_KEY = old;
});
