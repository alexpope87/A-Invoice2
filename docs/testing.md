# InvoiceAI — Testing & Validation

## 1. Testing Objective

The purpose of testing InvoiceAI is to verify the complete invoice-processing workflow and confirm that AI extraction, deterministic business rules and human review operate as separate components.

Testing covers:

1. PDF storage
2. AI document extraction
3. structured data persistence
4. deterministic validation
5. risk classification
6. automated decision routing
7. human review
8. manual decisions
9. failure handling

InvoiceAI is a portfolio MVP rather than a production accounting system, so testing focuses on validating the core architecture and business workflow.

---

## 2. Testing Strategy

Different parts of the application require different types of testing.

```text
AI Extraction
→ real PDF processing

Database
→ persistence testing

Validation Engine
→ controlled rule testing

Risk Engine
→ controlled decision testing

Decision Engine
→ routing testing

Human Review
→ manual workflow testing

External AI API
→ error and retry testing

Complete Workflow
→ end-to-end testing
```

This approach makes it possible to test deterministic business logic independently from the probabilistic AI extraction layer.

---

## 3. Database Integration

The application was migrated from initial mock frontend data to real Supabase data.

Testing confirmed that:

- invoice records can be created
- records are stored in PostgreSQL
- Dashboard data is retrieved from the database
- Invoice History reads real records
- Review Queue reads real records
- Invoice Analysis retrieves stored invoice information

**Status: VERIFIED**

---

## 4. Private PDF Storage

PDF invoices are stored in a private Supabase Storage bucket.

Testing confirmed that:

- PDFs can be uploaded successfully
- the application retains the storage path
- documents can be retrieved server-side for AI processing
- PDFs remain stored if AI processing temporarily fails

The source document is therefore preserved independently from the AI processing result.

**Status: VERIFIED**

---

## 5. Gemini Extraction

Real invoice PDFs were successfully processed through the server-side Gemini integration.

An early test successfully extracted information from an Octopus Energy Italia invoice.

A later final end-to-end test used the same type of real invoice with the updated AI model:

```text
Model:
gemini-3.5-flash-lite

Supplier:
Octopus Energy Italia Srl

Invoice number:
KE-26-E7C1C90F-007

Invoice date:
2026-07-08

Subtotal:
€23.25

VAT:
€2.33

Total:
€25.58

Currency:
EUR

Due date:
2026-07-28

Category:
utilities

AI confidence:
100%
```

The extracted information was successfully stored and passed to the downstream validation workflow.

**Status: VERIFIED**

---

## 6. AI Model Availability Testing

The project originally used:

```text
gemini-3.6-flash
```

During testing, the model intermittently returned:

```text
503 UNAVAILABLE
```

with an upstream message indicating high model demand.

Further diagnosis confirmed that:

- the model existed
- the API endpoint was correct
- PDF retrieval from Supabase succeeded
- the PDF request format was valid
- the model could successfully process the same document
- the failure was caused by temporary service availability rather than application logic

The free-tier environment also returned:

```text
429 RESOURCE_EXHAUSTED
```

after multiple requests.

The free-tier request allowance was sufficiently small that aggressive automatic retries could quickly consume the available quota.

---

## 7. Improved Gemini Error Handling

The Gemini retry and error-handling strategy was updated after diagnosing the availability issue.

The final policy is:

### 503 UNAVAILABLE

```text
Attempt 1
   ↓
503
   ↓
Wait approximately 5 seconds
   ↓
Attempt 2
```

If the second attempt also fails:

- processing stops
- HTTP 503 is preserved
- the PDF remains stored
- no fabricated extraction is created
- the user can manually retry later

### 429 RESOURCE_EXHAUSTED

The application does not automatically retry.

Instead:

- HTTP 429 is preserved
- Google's suggested retry delay is used when available
- the user receives a controlled quota message
- the PDF remains stored

### Other errors

The endpoint also preserves meaningful HTTP error behavior rather than converting every upstream failure into HTTP 200.

**Status: VERIFIED / IMPLEMENTED**

---

## 8. AI Model Change

Because `gemini-3.6-flash` continued to experience high demand during testing, the invoice extraction model was changed to:

```text
gemini-3.5-flash-lite
```

No other part of the workflow was changed.

The following remained unchanged:

- Gemini API key
- extraction workflow
- extraction fields
- PDF handling
- Supabase integration
- database schema
- validation engine
- risk engine
- decision engine
- frontend workflow
- retry/error handling

A subsequent real PDF test using `gemini-3.5-flash-lite` completed successfully.

**Status: VERIFIED**

---

## 9. Validation Engine Tests

The Validation Engine was tested independently using controlled inputs.

Validation results use:

```text
PASS
FAIL
NOT_CHECKED
```

### Test A — Valid Invoice

Input characteristics:

```text
Confidence: 98

Required fields:
present

Subtotal + VAT:
matches total

Dates:
valid
```

Expected result:

```text
Validation: PASS
Risk: LOW
Status: AUTO-APPROVED
```

Result:

**PASS**

---

### Test B — Total Calculation Failure

Input:

```text
Subtotal: €1,200
VAT: €264
Total: €1,500
```

Expected calculation:

```text
€1,200 + €264
= €1,464
```

The invoice total does not match the calculated total.

Expected result:

```text
Total Calculation: FAIL
Risk: HIGH
Status: NEEDS REVIEW
```

Result:

**PASS**

---

### Test C — Medium AI Confidence

Input:

```text
AI confidence: 82
Validation checks: otherwise valid
```

Expected result:

```text
Risk: MEDIUM
Status: NEEDS REVIEW
```

Result:

**PASS**

---

### Test D — Missing Required Field

Input:

```text
invoice_number = null
```

Expected result:

```text
Required Fields: FAIL
Risk: HIGH
Status: NEEDS REVIEW
```

Result:

**PASS**

---

### Test E — Validation Cannot Be Completed

Input:

```text
total_calculation = NOT_CHECKED
```

Expected result:

```text
Risk: MEDIUM
Status: NEEDS REVIEW
```

unless another HIGH-risk condition exists.

Result:

**PASS**

This confirms that the system distinguishes between:

```text
FAIL
```

and:

```text
NOT_CHECKED
```

A validation that cannot be performed is not automatically treated as a failed validation.

---

## 10. Risk Engine

The deterministic Risk Engine classifies invoices as:

```text
LOW
MEDIUM
HIGH
```

Risk is based on factors including:

- AI extraction confidence
- validation failures
- missing required information
- validations that could not be completed

The LLM does not assign the final operational risk level.

Controlled rule tests confirmed the expected LOW, MEDIUM and HIGH behavior.

**Status: VERIFIED**

---

## 11. Decision Engine

The automated routing rules are:

```text
LOW
→ AUTO-APPROVED
```

```text
MEDIUM
→ NEEDS REVIEW
```

```text
HIGH
→ NEEDS REVIEW
```

The automated system does not assign:

```text
REJECTED
```

Rejection remains a human decision.

**Status: VERIFIED**

---

## 12. Final Successful End-to-End Test

A complete real-PDF test was performed after the final architecture and error-handling changes.

The tested workflow was:

```text
PDF Upload
    ↓
Private Supabase Storage
    ↓
Server-side Gemini Integration
    ↓
gemini-3.5-flash-lite
    ↓
Structured Data Extraction
    ↓
Database Persistence
    ↓
Validation Engine
    ↓
Risk Engine
    ↓
Decision Engine
    ↓
Invoice Analysis
```

The real invoice produced:

```text
Supplier:
Octopus Energy Italia Srl

Invoice:
KE-26-E7C1C90F-007

Subtotal:
€23.25

VAT:
€2.33

Total:
€25.58

Confidence:
100%
```

The financial calculation was consistent:

```text
€23.25 + €2.33 = €25.58
```

The application reported:

```text
5 of 5 validation checks passed

Risk:
LOW RISK

Decision:
AUTO-APPROVED
```

The Invoice Analysis interface also explicitly confirmed that the risk/decision was determined by deterministic rules rather than AI.

This verifies the complete successful automation path:

```text
REAL PDF
   ↓
AI EXTRACTION
   ↓
STRUCTURED DATA
   ↓
VALIDATION
   ↓
LOW RISK
   ↓
AUTO-APPROVED
```

**Status: VERIFIED**

---

## 13. Review Queue

The Review Queue is designed to contain only invoices with:

```text
status = NEEDS REVIEW
```

Testing confirmed that invoices requiring attention appear in the queue.

Invoices that have already been automatically processed or manually decided should not remain in the Review Queue.

**Status: VERIFIED**

---

## 14. Human-in-the-Loop Test

The exception workflow was tested separately using an existing demo invoice already classified as:

```text
HIGH RISK
NEEDS REVIEW
```

No Gemini request was required for this test.

The selected test invoice was:

```text
Supplier:
Officine Meccaniche Verdi

Invoice:
INV-2026-1005
```

The invoice contained validation concerns and was presented to the human operator for review.

The application displayed:

```text
HIGH RISK
```

along with the original validation results.

The operator manually selected:

```text
REJECT
```

After the manual action, the invoice status became:

```text
REJECTED
```

while the original:

```text
HIGH RISK
```

classification and validation information remained visible.

This verifies that the automated system identifies the exception, while the final rejection remains a human action.

**Status: VERIFIED**

---

## 15. Human-in-the-Loop Separation

The tested workflow demonstrates the intended separation of responsibilities:

```text
Validation / Risk Engine
        ↓
Identifies uncertainty or inconsistency
        ↓
NEEDS REVIEW
        ↓
Human operator
        ↓
Final decision
```

The automated system did not directly reject the invoice.

This is an important design principle of InvoiceAI:

**AI and deterministic rules support the decision process, while humans retain control over exception decisions.**

---

## 16. Preservation of Validation Context

After the manual rejection test, the invoice retained its original risk and validation context.

The application continued to display:

```text
HIGH RISK
```

and the individual validation results remained available.

This means the final operational status does not overwrite the reason why the invoice originally required review.

This behavior improves traceability and makes the workflow easier to audit.

**Status: VERIFIED**

---

## 17. Dashboard Integration

Dashboard metrics use real Supabase records rather than frontend mock values.

The application calculates metrics including:

- total invoices
- auto-approved invoices
- invoices requiring review
- automation rate
- average AI confidence
- estimated hours saved
- estimated operational savings

The automation-rate calculation excludes invoices still being processed from the completed-invoice denominator.

**Status: VERIFIED**

---

## 18. Failure-Safety Principles

Testing confirmed or validated the following failure-safety principles.

### No fabricated data

If Gemini processing fails, InvoiceAI does not create fake extracted invoice information.

### Preserve the source document

The uploaded PDF remains stored when AI processing fails.

### AI failure is not invoice failure

A Gemini service outage is treated as a processing problem rather than evidence that the invoice itself is invalid.

### No automatic rejection

HIGH-risk invoices are routed to human review rather than automatically rejected.

### Preserve validation context

A human decision does not remove the original risk and validation information.

---

## 19. Final Test Status

| Component | Status |
|---|---|
| Supabase database integration | VERIFIED |
| Private PDF storage | VERIFIED |
| Gemini PDF extraction | VERIFIED |
| Structured extraction | VERIFIED |
| Extraction → database persistence | VERIFIED |
| Invoice Analysis | VERIFIED |
| Validation rules | VERIFIED |
| Risk Engine | VERIFIED |
| Decision Engine | VERIFIED |
| LOW RISK → AUTO-APPROVED | VERIFIED |
| HIGH RISK → NEEDS REVIEW | VERIFIED |
| Review Queue | VERIFIED |
| Manual rejection | VERIFIED |
| Validation/risk preservation after human decision | VERIFIED |
| Dashboard database integration | VERIFIED |
| Gemini 503 handling | VERIFIED |
| Gemini 429 handling | IMPLEMENTED |
| Manual retry workflow | IMPLEMENTED |
| Complete PDF → decision workflow | VERIFIED |
| Human-in-the-loop workflow | VERIFIED |

---

## 20. Production Testing Roadmap

The MVP workflow has been validated, but a production deployment would require significantly broader testing.

Recommended areas include:

### Document Variety

Test invoices with:

- different suppliers
- different layouts
- scanned documents
- low-quality PDFs
- multiple pages
- different currencies
- missing fields
- multiple VAT rates

### Business Logic

Test:

- rounding differences
- invalid dates
- missing totals
- zero-value invoices
- credit notes
- unusual tax treatments
- duplicate invoices

### AI Reliability

Measure:

- field-level extraction accuracy
- confidence calibration
- extraction failure rate
- retry success rate
- processing latency
- AI cost per invoice

### Security

Test:

- authentication
- authorization
- organization-level data isolation
- storage permissions
- API-secret exposure
- production RLS policies

### Operational Reliability

Test:

- AI provider outages
- API rate limits
- concurrent uploads
- database failures
- storage failures
- asynchronous processing
- monitoring and alerting

---

## 21. MVP Testing Conclusion

The core InvoiceAI workflow has now been successfully validated.

Two fundamental paths were tested:

### Automated Path

```text
Real Invoice PDF
      ↓
Gemini Extraction
      ↓
Deterministic Validation
      ↓
LOW RISK
      ↓
AUTO-APPROVED
```

### Human Review Path

```text
Invoice Exception
      ↓
Deterministic Validation
      ↓
HIGH RISK
      ↓
NEEDS REVIEW
      ↓
Human Review
      ↓
REJECTED
```

Together, these tests validate the central architecture of InvoiceAI:

**AI extracts information, deterministic rules evaluate it, the system automates clear cases, and humans retain control over exceptions.**

The core MVP is therefore considered functionally validated for portfolio demonstration purposes.
