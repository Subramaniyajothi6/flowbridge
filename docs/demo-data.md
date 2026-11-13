# Demonstration data

Ready-made answers for testing and demonstrating FlowBridge. Copy each value into the Run now form.

**Customer email:** every run sends a real email to this address. Use an inbox you can open, and type it in where the tables say `YOUR TEST INBOX`. Real addresses are kept out of this file because the repository is public.

**After testing:** each run creates a real Jira ticket in project `SCRUM`, a row in the Tasks sheet, and for Highest priority a Slack message. Delete the test tickets in Jira when they are no longer wanted.

## Support request to Jira

Sign in as Lena (Business User), find **Support request to Jira** under Your automations, and click **Run now**.

Priority decides the path: **Highest** escalates the ticket, alerts `#all-flowbridge-demo` in Slack and sends the "escalated" email. Low, Medium and High send the "received" email. Every path adds a comment to the ticket saying which email was sent.

### 1. High priority: a delayed delivery (normal path)

| Question | Answer |
|---|---|
| Customer name | Asha Verma |
| Customer email | YOUR TEST INBOX |
| Company | Verma Textiles |
| Order number | ML-48213 |
| Priority | High |
| Subject | Shipment ML-48213 is three days late |
| What happened | Our shipment of cotton rolls was due on Monday and the tracking page has not changed since it left the Chennai hub. We have a production run waiting on it. Please tell us where it is and when it will arrive. |

**Expect:** a Jira ticket with priority High, a new row in the Tasks sheet, a "we have received your request" email, and a comment on the ticket. No Slack alert.

### 2. Highest priority: damaged goods (urgent path)

| Question | Answer |
|---|---|
| Customer name | Rohan Mehta |
| Customer email | YOUR TEST INBOX |
| Company | Mehta Pharma Distributors |
| Order number | ML-48377 |
| Priority | Highest |
| Subject | Temperature-controlled shipment arrived damaged |
| What happened | Two of the six cold boxes in order ML-48377 arrived with broken seals and the temperature logger shows it went above 8°C for four hours. These are vaccines for a clinic opening tomorrow. We need a replacement shipment today. |

**Expect:** a Jira ticket that is then escalated, a Slack alert in `#all-flowbridge-demo`, an "escalated" email, a row in the Tasks sheet, and a comment on the ticket.

### 3. Medium priority: wrong delivery address

| Question | Answer |
|---|---|
| Customer name | Priya Nair |
| Customer email | YOUR TEST INBOX |
| Company | Nair Home Furnishings |
| Order number | ML-48402 |
| Priority | Medium |
| Subject | Please change the delivery address before dispatch |
| What happened | We entered our old warehouse address for order ML-48402. The new address is Plot 14, Industrial Estate, Kochi 682030. The order has not been dispatched yet according to the tracking page. |

### 4. Low priority: invoice question

| Question | Answer |
|---|---|
| Customer name | Daniel Fernandes |
| Customer email | YOUR TEST INBOX |
| Company | Fernandes Exports |
| Order number | ML-47950 |
| Priority | Low |
| Subject | Invoice shows the wrong GST number |
| What happened | The invoice for order ML-47950 has our old GST number. Could you send a corrected invoice when convenient? There is no rush. |

### Same data as JSON

For the builder's Test workflow, or the "Enter JSON instead" option on Run now. Replace `YOUR TEST INBOX` first.

```json
{ "body": { "name": "Asha Verma", "email": "YOUR TEST INBOX", "company": "Verma Textiles", "order": "ML-48213", "priority": "High", "subject": "Shipment ML-48213 is three days late", "details": "Our shipment of cotton rolls was due on Monday and the tracking page has not changed since it left the Chennai hub. We have a production run waiting on it." } }
```

```json
{ "body": { "name": "Rohan Mehta", "email": "YOUR TEST INBOX", "company": "Mehta Pharma Distributors", "order": "ML-48377", "priority": "Highest", "subject": "Temperature-controlled shipment arrived damaged", "details": "Two of the six cold boxes arrived with broken seals and the temperature logger shows it went above 8°C for four hours. We need a replacement shipment today." } }
```

### Paths the Run now form cannot reach

- **No customer email:** the form requires an email, so the "Alert: no email address" path only happens when the workflow is started from its webhook address without one.
- **Jira fails:** happens only if Jira refuses the ticket, for example when the Jira connection is removed. Then Slack is alerted and the customer gets a "reference to follow" email.
