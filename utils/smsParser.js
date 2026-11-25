export const REVIEW_CATEGORIES = ['Food', 'Transport', 'Shopping', 'Bills', 'Health', 'Other'];

const rejected = /\b(?:otp|one.time password|verification code|declined|failed|unsuccessful|reversed|refunded|pending|requested|collect request|cashback offer|credit card bill|payment due|minimum due|win prizes)\b/i;
const reference = /\b(?:upi\s*[-/]?\s*(?:ref(?:erence)?|rrn|transaction id|txn id)|rrn|ref(?:erence)?(?:\s*(?:no|number|id))?)\.?\s*[:#.-]?\s*(\d{12})\b/i;
const amountPattern = /(?:₹|\b(?:INR|Rs\.?))\s*([\d,]+(?:\.\d{1,2})?)/gi;
const movement = /\b(debited|paid|sent|credited|received|transferred)\b/gi;
const upiMarker = /\b(?:UPI|VPA|RRN|GPay|Google Pay)\b/i;
const bankAccount = /\b(?:a\/c|acct|account)\b/i;
const directionBeforeAmount = /\b(credited|debited|cr|dr)\b\s*(?:(?:by|with|for)\s+|[:=-]\s*)?$/i;
const directionAfterAmount = /^\s*(?:(?:is|was|has been)\s+)?\b(credited|debited|cr|dr)\b/i;
const balanceBeforeAmount = /\b(?:balance|(?:(?:avl|avail(?:able)?)\.?\s*)?bal)\s*[:.]?\s*$/i;
const incompleteBankMovement = /\b(?:(?:will|would|may|to)\s+be|not(?:\s+been)?|scheduled to be)\s+(?:credited|debited)\b/i;

export function merchantKey(merchant) {
  return merchant.trim().toLowerCase().replace(/\s+/g, ' ');
}

function guessCategory(merchant) {
  if (/zomato|swiggy|restaurant|cafe|food/i.test(merchant)) return 'Food';
  if (/uber|ola\b|rapido|metro|irctc|fuel/i.test(merchant)) return 'Transport';
  if (/amazon|flipkart|myntra|mart/i.test(merchant)) return 'Shopping';
  if (/electric|airtel|jio\b|broadband|water bill/i.test(merchant)) return 'Bills';
  if (/pharma|hospital|clinic|medical/i.test(merchant)) return 'Health';
  return 'Other';
}

function messageDate(text, fallback) {
  const numeric = text.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{4}|\d{2})\b/);
  const named = text.match(/\b(\d{1,2})[- ]?([A-Za-z]{3})[- ]?(\d{4}|\d{2})\b/);
  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (!numeric && !named && !iso) return fallback;
  const months = 'jan feb mar apr may jun jul aug sep oct nov dec'.split(' ');
  const [day, month, year] = iso ? [iso[3], iso[2], iso[1]] : numeric
    ? numeric.slice(1) : [named[1], months.indexOf(named[2].toLowerCase()) + 1, named[3]];
  const date = new Date(Date.UTC(Number(year) + (String(year).length === 2 ? 2000 : 0), Number(month) - 1, Number(day), 6, 30));
  return date.getUTCDate() === Number(day) && date.getUTCMonth() === Number(month) - 1 ? date : fallback;
}

export function parsePaymentAlert(raw, receivedAt = Date.now(), categories = {}) {
  if (typeof raw !== 'string') return null;
  const text = raw.replace(/\s+/g, ' ').trim();
  const isUpi = upiMarker.test(text);
  if (rejected.test(text) || incompleteBankMovement.test(text)) return null;
  if (!isUpi && !bankAccount.test(text)) return null;

  const [amountMatch] = text.matchAll(amountPattern);
  if (!amountMatch) return null;
  const before = text.slice(0, amountMatch.index);
  if (balanceBeforeAmount.test(before)) return null;
  const amount = Number(amountMatch[1].replaceAll(',', ''));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const afterAmount = text.slice(amountMatch.index + amountMatch[0].length);
  const bankVerb = before.match(directionBeforeAmount)?.[1] || afterAmount.match(directionAfterAmount)?.[1];
  const direction = (isUpi ? [...text.matchAll(movement)][0]?.[1] : null) || bankVerb;
  if (!direction) return null;
  const type = /^(credited|received|cr)$/i.test(direction) ? 'income' : 'expense';
  const fallbackTitle = isUpi ? 'UPI transaction' : type === 'expense' ? 'Bank debit'
    : /\bsalary\b/i.test(text) ? 'Salary' : 'Bank credit';
  const party = type === 'income' ? /\bfrom\s+(.+)/i : /\b(?:to|at|towards)\s+(.+)/i;
  const tail = afterAmount.replace(/^\s*(?:debited|credited)\s+(?:to|from)\s+(?:your\s+)?(?:bank\s+)?(?:a\/c|acct|account)\s*[\w*.-]*/i, '');
  const details = isUpi ? tail : tail.split(/\b(?:avl|avail(?:able)?\.?\s+bal(?:ance)?|bal(?:ance)?|not\s+u)\b/i)[0];
  const merchant = (details.match(party)?.[1] || details.match(/\b(?:VPA|Info)\s*[:/-]?\s*(.+)/i)?.[1] || before.match(party)?.[1] || '')
    .split(/\s+(?:on|via|using|with|UPI|Ref(?:erence)?|RRN|Txn|Avl|Balance|VPA)\b|[;,]|\.(?=\s|$)/i)[0]
    .trim()
    .slice(0, 80) || fallbackTitle;
  const upiRefId = isUpi ? text.match(reference)?.[1] || null : null;
  const time = new Date(receivedAt);
  const fallback = Number.isFinite(time.getTime()) ? time : new Date();
  const timestamp = messageDate(text, fallback);
  const remembered = categories[merchantKey(merchant)];
  return {
    title: merchant,
    amount,
    type,
    category: REVIEW_CATEGORIES.includes(remembered) ? remembered : guessCategory(merchant),
    upiRefId,
    createdAt: timestamp.toISOString(),
    ...(isUpi && {
      rawSmsSnippet: text.replace(/[\w.+-]+@[\w.-]+/g, '[UPI address]').replace(/\d+/g, '•').slice(0, 180),
    }),
  };
}

export function captureKey(item, alert) {
  if (item.upiRefId) return item.upiRefId;
  // Identical inbox messages can describe separate payments received at different times.
  const body = merchantKey(alert.body);
  let hash = 2166136261;
  for (const char of body) hash = Math.imul(hash ^ char.codePointAt(0), 16777619);
  return `receipt-${alert.timestamp ?? 'paste'}-${(hash >>> 0).toString(36)}`;
}
