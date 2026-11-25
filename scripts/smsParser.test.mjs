import assert from 'node:assert/strict';
import { test } from 'node:test';
import { captureKey, parsePaymentAlert } from '../utils/smsParser.js';

const time = Date.parse('2026-11-24T08:54:00Z');
const fixtures = [
  ['HDFC', 'Rs.1,245.50 debited from HDFC Bank A/c XX1234 to Zomato on 24-11-26. UPI Ref No 628412345601', 1245.5, 'expense', 'Zomato'],
  ['ICICI', 'INR 350.00 debited from ICICI Bank A/c XX1144 to Apollo Pharmacy on 24-Nov-26. UPI Ref: 628412345602', 350, 'expense', 'Apollo Pharmacy'],
  ['SBI', 'Dear UPI user, A/c X123 debited by  Rs.210.00 on 24Nov26. Info: IRCTC. Ref No 628412345603', 210, 'expense', 'IRCTC'],
  ['Axis', 'INR 700 credited to Axis Bank A/c XX9911 from Rahul on 24/11/2026 via UPI. RRN: 628412345604', 700, 'income', 'Rahul'],
  ['Kotak', 'Paid ₹75 to Metro via UPI from Kotak account ending 1234. UPI Ref 628412345605', 75, 'expense', 'Metro'],
  ['Yes Bank', 'Yes Bank A/c X1234 credited INR 950 via UPI from Meera. Ref 628412345606', 950, 'income', 'Meera'],
  ['IDFC', 'Rs 129 debited from IDFC FIRST Bank A/c XX1122 at Cafe Coffee Day on 24-11-26. UPI Ref 628412345607', 129, 'expense', 'Cafe Coffee Day'],
  ['Paytm', 'Received ₹500 from Akash via UPI in Paytm Payments Bank. UPI RRN 628412345608', 500, 'income', 'Akash'],
  ['GPay', 'Google Pay: You sent ₹299 to Swiggy. UPI transaction ID: 628412345609', 299, 'expense', 'Swiggy'],
];
for (const [index, [bank, message, amount, type, title]] of fixtures.entries()) {
  test(bank, () => {
    const item = parsePaymentAlert(message, time);
    assert.deepEqual([item.amount, item.type, item.title], [amount, type, title]);
    assert.equal(item.upiRefId, String(628412345601 + index));
    assert.ok(item.createdAt.startsWith('2026-11-24'));
    assert.ok(!item.rawSmsSnippet.includes(item.upiRefId));
  });
}
for (const message of [
  'OTP 123456 for UPI payment of INR 200 to Zomato',
  'GPay payment failed. INR 700 was not debited',
  'Credit card bill payment due Rs. 800. Pay with UPI',
  'GPay payment requested for ₹100',
  'Win prizes when you paid ₹499 on UPI',
  'UPI payment declined. INR 15 debited',
  'A/c XX1234 will be credited with INR 2500 on 27-Nov-26',
  'A/c XX1234 not debited INR 250. Bal INR 11000.',
  'A/c XX1234 Bal Rs 250.00 after the last debit.',
  'Account XX1234: Pay your EMI of INR 500 on 27-Nov-26.',
]) test(message, () => assert.equal(parsePaymentAlert(message, time), null));

for (const [name, message, type, amount, title] of [
  ['Union Bank Dr', 'Union Bank of India A/c*4321 Dr Rs12.00 on 25-11-26 10:46 by MB 111111222222 Fv.CMP P, Bal Rs912.34 Not U?Call your bank.', 'expense', 12, 'Bank debit'],
  ['Union Bank Cr salary', 'Union Bank of India A/c*4321 Cr Rs52,000.00 on 25-11-26 10:46 by NEFT SALARY, Bal Rs72,345.67', 'income', 52000, 'Salary'],
  ['NEFT credit', 'INR 2,000.50 credited to A/c XX1234 from Example Co via NEFT. Available balance: INR 3200.', 'income', 2000.5, 'Example Co'],
  ['ATM debit', 'Account debited INR 250 at ATM', 'expense', 250, 'ATM'],
  ['UPI debit abbreviated by the bank', 'A/c XX1234 Dr Rs75.00 to Metro via UPI. RRN: 111111222222', 'expense', 75, 'Metro'],
]) {
  test(name, () => {
    const item = parsePaymentAlert(message, time);
    assert.deepEqual([item?.type, item?.amount, item?.title], [type, amount, title]);
    if (!message.includes('UPI')) {
      assert.equal(item.upiRefId, null);
      assert.equal(item.rawSmsSnippet, undefined);
    }
  });
}

test('remembered category and receipt timestamp', () => {
  const item = parsePaymentAlert('Google Pay: You paid ₹300 to Zomato.', time, { zomato: 'Bills' });
  assert.equal(item.category, 'Bills');
  assert.equal(item.createdAt, new Date(time).toISOString());
});

test('an inbox rescan keeps the same identity without collapsing separate receipts', () => {
  const alert = { body: 'Google Pay: You paid ₹40 to Cafe.', timestamp: time };
  const item = parsePaymentAlert(alert.body, alert.timestamp);
  assert.equal(captureKey(item, alert), captureKey(item, { ...alert }));
  assert.notEqual(captureKey(item, alert), captureKey(item, { ...alert, timestamp: time + 60_000 }));
});

test('a reference identifies the same payment in an SMS and a GPay notification', () => {
  const sms = { body: fixtures[0][1], timestamp: time };
  const notification = { body: 'Google Pay: You paid ₹1,245.50 to Zomato. Ref: 628412345601' };
  assert.equal(captureKey(parsePaymentAlert(sms.body, time), sms),
    captureKey(parsePaymentAlert(notification.body, time), notification));
});
