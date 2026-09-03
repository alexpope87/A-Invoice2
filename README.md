# Invoice Flow

Build a professional SaaS web application called "InvoiceAI".

InvoiceAI is an AI-powered invoice processing and business automation platform for small and medium-sized businesses.

The purpose of the MVP is to demonstrate an end-to-end business automation workflow:

Invoice upload

→ AI data extraction

→ Validation

→ Classification

→ Risk assessment

→ Approval or human review

→ Dashboard and reporting

IMPORTANT:

For this first version, focus ONLY on the frontend structure, user experience and navigation.

Do NOT implement the AI integration yet.

Do NOT implement authentication yet.

Do NOT implement real email integrations.

Do NOT implement real accounting integrations.

Do NOT create payment functionality.

Use realistic mock invoice data so the dashboard and tables look functional.

Create the following main sections:

1. DASHBOARD

Create a professional business dashboard showing:

- Total invoices processed

- Automatically approved invoices

- Invoices requiring review

- Automation rate

- Average AI confidence

- Estimated hours saved

- Estimated monthly cost savings

Include:

- KPI cards

- Recent invoices table

- Review queue / alerts

- Simple invoice processing activity visualization

Use realistic sample data.

Example:

Total invoices: 247

Automatically approved: 203

Needs review: 44

Automation rate: 82%

Average AI confidence: 94%

Estimated hours saved: 31.4

Estimated monthly savings: €785

2. UPLOAD INVOICE

Create a page where the user can upload a PDF invoice.

Include:

- Drag and drop upload area

- File selection button

- File type indication

- "Analyze Invoice" button

- Processing state

For now, simulate the processing using mock data.

3. INVOICE ANALYSIS

Create a detailed invoice analysis page.

Show:

- Supplier name

- Invoice number

- Invoice date

- Due date

- Subtotal

- VAT

- Total

- Currency

- Category

- AI confidence score

- Risk level

- Invoice status

Also show a validation section with:

- Required fields check

- Total calculation check

- VAT check

- Date validation

Show a clear final decision:

AUTO-APPROVED

or

NEEDS REVIEW

If the invoice requires review, show the reason.

4. REVIEW QUEUE

Create a page showing invoices requiring human review.

Table columns:

- Invoice number

- Supplier

- Amount

- Risk

- Reason

- Date

- Status

Include filters for:

- Risk

- Status

- Category

5. INVOICE HISTORY

Create a page containing all processed invoices.

Table columns:

- Invoice number

- Supplier

- Date

- Amount

- Category

- AI confidence

- Risk

- Status

Include search and filtering.

6. NAVIGATION

Create a clean sidebar navigation with:

- Dashboard

- Upload Invoice

- Review Queue

- Invoice History

Include the InvoiceAI logo/name at the top.

7. DESIGN

The application should look like a modern B2B SaaS product.

Design requirements:

- Professional

- Clean

- Minimal

- Data-oriented

- Desktop-first

- Easy to understand

- Suitable for a finance/operations team

Do NOT make it look like a chatbot or consumer AI application.

Use clear visual distinctions between:

- LOW / MEDIUM / HIGH risk

- AUTO-APPROVED

- NEEDS REVIEW

- PROCESSING

- REJECTED

Use realistic sample invoice data throughout the application.

The code should be modular and maintainable.

At this stage, prioritize a polished MVP interface and user experience over backend functionality.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://invoice-flow-ai-27.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a0554c85-1baa-42f4-b83f-76ccf1fc8ea0).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
