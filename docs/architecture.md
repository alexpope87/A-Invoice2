# InvoiceAI — System Architecture

## 1. Architecture Overview

InvoiceAI is designed as a modular AI-enabled business automation application.

The architecture separates four main responsibilities:

1. User interface and workflow
2. Data and document storage
3. AI document understanding
4. Deterministic validation and decision logic

This separation is intentional.

Google Gemini is responsible for understanding unstructured invoice documents, while deterministic application logic is responsible for validation, risk classification and operational decisions.

---

## 2. High-Level Architecture

```text
┌─────────────────────┐
│        USER         │
└──────────┬──────────┘
           │
           │ Upload PDF
           ▼
┌─────────────────────┐
│   InvoiceAI UI      │
│ React / TanStack    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Supabase Storage    │
│ Private PDF Bucket  │
└──────────┬──────────┘
           │
           │ PDF storage path
           ▼
┌─────────────────────┐
│ Secure Server Route │
│ extract-invoice     │
└──────────┬──────────┘
           │
           │ PDF
           ▼
┌─────────────────────┐
│   Google Gemini     │
│ Document Extraction │
└──────────┬──────────┘
           │
           │ Structured data
           ▼
┌─────────────────────┐
│ Validation Engine   │
│ Deterministic Rules │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Risk Engine         │
│ Deterministic Rules │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Decision Engine     │
└──────┬────────┬─────┘
       │        │
       │        │
       ▼        ▼
 AUTO-APPROVED  NEEDS REVIEW
                    │
                    ▼
              Human Decision
                    │
             ┌──────┴──────┐
             ▼             ▼
          APPROVE        REJECT
             │             │
             └──────┬──────┘
                    ▼
┌─────────────────────────────┐
│ Supabase / PostgreSQL       │
│ Invoice & Processing Data   │
└─────────────────────────────┘
```

---

## 3. Application Layer

### Technologies

- React
- TanStack
- Lovable

The application layer provides the user interface for:

- Dashboard
- Invoice Upload
- Invoice Analysis
- Review Queue
- Invoice History

Lovable was used as the AI-assisted development platform for building and iterating the application.

The application itself is not dependent on Lovable for invoice intelligence.

Invoice intelligence is provided separately through the Google Gemini API.

This distinction separates the tool used to build the application from the AI service used by the application at runtime.

---

## 4. Data Layer

### Technology

**Supabase / PostgreSQL**

Supabase is used as the backend data platform.

The invoice database stores information such as:

- supplier
- invoice number
- invoice date
- due date
- subtotal
- VAT
- total
- currency
- AI confidence
- validation results
- risk level
- processing status
- review reason

The database therefore stores both the extracted invoice information and the operational state of the workflow.

---

## 5. Document Storage

### Technology

**Supabase Storage**

Uploaded invoice PDFs are stored in a private Supabase Storage bucket.

The document is stored separately from the structured invoice information contained in PostgreSQL.

Conceptually:

```text
PDF document
→ Supabase Storage

Structured invoice data
→ PostgreSQL
```

This separation allows the application to retain the source document while processing and querying structured information independently.

---

## 6. AI Extraction Layer

### Technology

**Google Gemini API**

Gemini is used for document understanding.

Its responsibility is limited to extracting structured information from an unstructured PDF.

Examples include:

- supplier name
- invoice number
- invoice date
- due date
- subtotal
- VAT
- total
- currency
- category
- extraction confidence

The expected transformation is:

```text
Unstructured PDF
        ↓
      Gemini
        ↓
Structured JSON
```

The AI model is instructed not to invent missing information.

If information cannot be reliably extracted, the system should represent the field as missing rather than generate a value.

---

## 7. Secure AI Integration

The Gemini API is called from a server-side route rather than directly from the browser.

Conceptually:

```text
Browser
   ↓
InvoiceAI Server
   ↓
Gemini API
```

rather than:

```text
Browser
   ↓
Gemini API
```

The `GEMINI_API_KEY` is stored as a server-side secret.

This prevents the API credential from being exposed in client-side application code.

The server route:

1. receives the invoice reference and storage path
2. accesses the PDF stored in the private bucket
3. sends the document to Gemini
4. receives structured extraction results
5. returns the result to the application workflow

---

## 8. Validation Engine

The Validation Engine is implemented using deterministic application logic.

Gemini does not determine whether an invoice is valid.

Example validations include:

### Required Fields

Checks whether required invoice information is present.

### Total Calculation

Checks whether:

```text
subtotal + VAT ≈ total
```

A small tolerance can be used for rounding differences.

### Date Validation

Checks whether dates are valid and logically consistent.

For example:

```text
due_date >= invoice_date
```

### Amount Sanity

Checks whether extracted monetary values are structurally valid.

### VAT Information

Where sufficient data exists, the system can calculate the effective VAT rate for informational purposes.

The MVP does not assume that every valid invoice must use one specific VAT rate.

Validation results use:

```text
PASS
FAIL
NOT_CHECKED
```

`NOT_CHECKED` indicates that insufficient information was available to perform a reliable validation.

---

## 9. Why Validation Is Separate from AI

This is a key architectural decision.

An LLM is useful for interpreting an unstructured document.

Mathematical and business-rule validation does not require probabilistic reasoning.

For example:

```text
Gemini:
"What is the invoice total?"

Deterministic code:
"Does subtotal + VAT equal that total?"
```

This provides more predictable and explainable validation behavior.

---

## 10. Risk Engine

After validation, deterministic rules classify the invoice into one of three risk levels:

```text
LOW
MEDIUM
HIGH
```

Risk is based on factors such as:

- AI extraction confidence
- failed validation checks
- missing required information
- validations that could not be completed

The LLM does not assign the final operational risk level.

---

## 11. Decision Engine

The Decision Engine converts risk and validation results into an operational workflow.

### LOW Risk

```text
LOW
 ↓
AUTO-APPROVED
```

### MEDIUM Risk

```text
MEDIUM
 ↓
NEEDS REVIEW
```

### HIGH Risk

```text
HIGH
 ↓
NEEDS REVIEW
```

The automated engine does not reject invoices.

Rejection remains a human decision.

---

## 12. Human-in-the-Loop Design

The Review Queue contains invoices that require human attention.

The objective is not to remove humans from the process.

The objective is to change where human effort is used.

Traditional model:

```text
Every Invoice
     ↓
Human Processing
```

InvoiceAI model:

```text
Every Invoice
     ↓
Automated Processing
     ↓
Is the invoice clear?
   /           \
 YES            NO
  │              │
  ▼              ▼
Automated     Human Review
```

Humans therefore focus primarily on exceptions rather than every document.

---

## 13. Processing Flow

The intended complete processing sequence is:

```text
1. User uploads PDF

2. PDF is stored in private Supabase Storage

3. Invoice database record is created

4. Secure server route sends PDF to Gemini

5. Gemini extracts structured invoice information

6. Extracted information is saved to PostgreSQL

7. Validation Engine checks the information

8. Validation results are saved

9. Risk Engine calculates the risk level

10. Decision Engine assigns the operational status

11. Invoice Analysis displays the result

12. If required, invoice enters Review Queue

13. Human reviews the exception

14. Final human decision is stored
```

---

## 14. Failure Handling

External AI services can temporarily fail or become unavailable.

InvoiceAI therefore follows a fail-safe approach.

If AI processing fails:

- no fake invoice information is generated
- the uploaded PDF remains stored
- the user receives a processing error
- processing can be retried

The current implementation distinguishes between temporary Gemini service availability errors and API quota errors. A temporary `503 UNAVAILABLE` response can trigger one controlled retry, while `429 RESOURCE_EXHAUSTED` does not trigger automatic retries. In both cases, the source PDF remains stored and no fabricated extraction result is created.

If automated decision processing fails, the invoice should not be silently approved.

The safer operational path is human review.

---

## 15. Security Model

Current MVP security principles include:

### Private document storage

Invoice PDFs are stored in a private Supabase bucket.

### Server-side API credentials

The Gemini API key is not exposed to the browser.

### Row Level Security

Supabase Row Level Security is enabled.

The current policies are intended for development/demo use.

A production version would require authenticated, organization-specific access policies.

 ### Test Data

Development primarily uses synthetic or non-sensitive invoice data. Real documents used for validation should not contain sensitive or confidential business information.
---

## 16. Technology Responsibilities

| Technology | Responsibility |
|---|---|
| Lovable | AI-assisted application development |
| React / TanStack | Application and user interface |
| Supabase PostgreSQL | Structured invoice and workflow data |
| Supabase Storage | Private PDF storage |
| Google Gemini | PDF understanding and data extraction |
| Server Route | Secure orchestration between storage and Gemini |
| Deterministic Code | Validation, risk and decision logic |
| GitHub | Source control and project documentation |

---

## 17. Design Principles

InvoiceAI follows several core design principles:

### AI where AI adds value

Use AI for interpreting unstructured documents.

### Deterministic logic where rules are sufficient

Use conventional code for calculations, validation and operational routing.

### Human oversight for uncertainty

Escalate ambiguous or problematic invoices rather than automatically rejecting them.

### Fail safely

External AI failures must not result in fabricated data or accidental approval.

### Separate responsibilities

Storage, AI extraction, validation and decision-making remain distinct components.

---

## 18. Production Evolution

A production architecture could extend the current MVP with:

- user authentication
- role-based access control
- organization-level data isolation
- configurable validation rules
- configurable approval thresholds
- duplicate invoice detection
- supplier master-data integration
- purchase-order matching
- ERP integration
- complete audit logging
- background processing queues
- monitoring and alerting
- AI-provider fallback strategies

---

## 19. Architecture Summary

InvoiceAI uses Generative AI as one component of a broader automation system rather than allowing the LLM to control the entire workflow.

The architecture can be summarized as:

```text
AI
↓
Understand the document

Deterministic Rules
↓
Validate the information

Decision Engine
↓
Automate clear cases

Human Review
↓
Handle exceptions
```

This architecture demonstrates how Generative AI can be integrated into a business workflow while maintaining predictable rules, traceability and human oversight.
