const API_URL = 'https://api.brevo.com/v3/smtp/email';
const TIMEOUT_MS = 10000;
let testFetch = null;

function getConfig() {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  const senderEmail = process.env.BREVO_SENDER_EMAIL?.trim();
  const senderName = process.env.BREVO_SENDER_NAME?.trim();
  if (!apiKey || !senderName || !senderEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail)) {
    const error = new Error('Brevo email configuration is incomplete or invalid');
    error.code = 'BREVO_CONFIG';
    throw error;
  }
  return { apiKey, senderEmail, senderName };
}
function validateEmailConfiguration() {
  if (process.env.NODE_ENV !== 'production' && process.env.EMAIL_MODE === 'mock') return true;
  getConfig();
  return true;
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}
function safeDiagnostic(error) {
  const status = Number(error?.status);
  let phase = error?.code === 'BREVO_CONFIG' ? 'configuration' : 'api_submission';
  if (error?.name === 'AbortError' || error?.code === 'ETIMEDOUT') phase = 'timeout';
  else if (error?.code === 'NETWORK_ERROR') phase = 'network';
  else if (status === 401 || status === 403) phase = 'authentication';
  else if (status === 429) phase = 'rate_limit';
  return { phase, ...(Number.isInteger(status) && status >= 100 && status <= 599 ? { status } : {}), ...(error?.code && /^[A-Z][A-Z0-9_]{0,39}$/.test(error.code) ? { code: error.code } : {}) };
}
function setFetchForTests(fetchImpl) {
  if (process.env.NODE_ENV !== 'test') throw new Error('Test client injection is disabled');
  testFetch = fetchImpl;
}
async function sendTransactionalEmail({ email, subject, text, html }) {
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    const error = new Error('Recipient email address is invalid'); error.code = 'INVALID_EMAIL'; throw error;
  }
  if (process.env.NODE_ENV !== 'production' && process.env.EMAIL_MODE === 'mock') return { success: true, mocked: true };
  const config = getConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await (testFetch || fetch)(API_URL, {
      method: 'POST', signal: controller.signal,
      headers: { 'api-key': config.apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ sender: { email: config.senderEmail, name: config.senderName }, to: [{ email: email.trim() }], subject, textContent: text, htmlContent: html }),
    });
    if (!response.ok) {
      const error = new Error(`Brevo rejected the email request with status ${response.status}`);
      error.status = response.status;
      error.code = [401, 403].includes(response.status) ? 'BREVO_AUTH' : response.status === 429 ? 'BREVO_RATE_LIMIT' : 'BREVO_API_ERROR';
      throw error;
    }
    return { success: true };
  } catch (error) {
    if (['BREVO_API_ERROR', 'BREVO_AUTH', 'BREVO_RATE_LIMIT'].includes(error?.code)) throw error;
    if (error?.name === 'AbortError') { const timeoutError = new Error('Brevo request timed out'); timeoutError.code = 'ETIMEDOUT'; throw timeoutError; }
    const networkError = new Error('Brevo network request failed'); networkError.code = 'NETWORK_ERROR'; throw networkError;
  } finally { clearTimeout(timeout); }
}
module.exports = { sendTransactionalEmail, validateEmailConfiguration, safeDiagnostic, setFetchForTests, escapeHtml };
