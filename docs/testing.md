# InvoiceAI — Testing & Validation

## 1. Testing Objective

The purpose of testing InvoiceAI is to verify the main components of the invoice-processing workflow:

1. PDF storage
2. AI document extraction
3. structured data persistence
4. deterministic validation
5. risk classification
6. decision routing
7. human-review behavior
8. failure handling

InvoiceAI is currently a portfolio MVP, so testing focuses on validating the core business logic and architecture rather than providing production-grade test coverage.

---

## 2. Components Tested

The following components have been tested during development:

- Supabase database integration
- private PDF storage
- Google Gemini invoice extraction
- structured invoice data extraction
- database persistence
- deterministic validation rules
- risk classification
- decision routing
- Review Queue filtering
- Dashboard status calculations
- AI failure handling

Some tests were performed end-to-end, while others were performed directly against the business rules.

---

## 3. Database Integration Test

The application was migrated from mock frontend data to real Supabase data.

Testing confirmed that:

- invoice records can be created
- records are stored in PostgreSQL
- Dashboard data is retrieved from the database
- Invoice History reads real records
- Review Queue reads real records
- Invoice Analysis retrieves invoice information from the database

This replaced the initial mock-data implementation.

---

## 4. PDF Storage Test

PDF invoices were uploaded to the private Supabase Storage bucket.

Testing confirmed that:

- the PDF is stored successfully
- the application retains the storage path
- the document can be accessed server-side for AI processing

The storage bucket is private rather than publicly exposing invoice documents.

---

## 5. Gemini Extraction Test

A real demo invoice PDF was processed through the Gemini extraction endpoint.

The extraction successfully returned invoice information including:

```text
Supplier:
Octopus Energy Italia Srl

Invoice number:
KE-26-E7C1C90F-007

Invoice date:
2026-07-08

Total:
€25.58

AI confidence:
98
```

This confirmed that the system was capable of:

```text
PDF
 ↓
Private Storage
 ↓
Server-side Endpoint
 ↓
Google Gemini
 ↓
Structured Invoice Data
```

This test was performed before the later validation and decision-engine changes.

---

## 6. Full Extraction-to-Database Test

A generated test PDF was later processed through the upload workflow.

Test invoice:

```text
Supplier:
ACME Supplies S.r.l.

Invoice number:
INV-2026-9001

Invoice date:
2026-03-14

Subtotal:
€1,200.00

VAT:
€264.00

Total:
€1,464.00

Category:
Office Furniture

AI confidence:
98
```

The test confirmed:

- PDF saved to private storage
- invoice database record created
- Gemini extraction executed
- extracted values returned
- invoice record updated
- Invoice Analysis displayed the extracted values

The temporary test record was deleted after verification.

At this stage, validation and risk logic had not yet been added to the full upload flow.

---

## 7. Validation Engine Tests

The Validation Engine was tested directly using controlled inputs.

These tests verify deterministic business logic rather than AI extraction.

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

Expected total:

```text
€1,200 + €264
= €1,464
```

Difference:

```text
€36
```

Expected result:

```text
Total Calculation: FAIL
Risk: HIGH
Status: NEEDS REVIEW
```

Expected review reason:

```text
Invoice total does not match subtotal + VAT.
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

The review reason correctly identifies confidence below the automatic-processing threshold.

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

Expected review reason:

```text
Required field missing: invoice_number.
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

The system correctly distinguishes between:

```text
FAIL
```

and:

```text
NOT_CHECKED
```

---

## 8. Risk Engine Tests

The Risk Engine was tested with three main confidence ranges.

### High Confidence

```text
confidence >= 90
+
required validation checks pass
```

Result:

```text
LOW
```

Invoice may be automatically processed.

### Medium Confidence

```text
confidence >= 70
and
confidence < 90
```

Result:

```text
MEDIUM
```

Invoice requires human review.

### Low Confidence

```text
confidence < 70
```

Result:

```text
HIGH
```

Invoice requires human review.

A missing confidence score is treated conservatively rather than allowing automatic approval.

---

## 9. Decision Engine Tests

The intended routing rules were verified as:

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

The automated engine does not assign:

```text
REJECTED
```

Rejection remains a human decision.

---

## 10. Review Queue Test

The Review Queue was checked after correcting an earlier filtering issue.

The intended rule is:

```text
status = NEEDS REVIEW
```

Only invoices requiring human attention should appear.

The Review Queue should not contain:

```text
AUTO-APPROVED
REJECTED
```

This behavior was confirmed after the filtering correction.

---

## 11. Dashboard Test

Dashboard metrics were connected to real Supabase records rather than mock frontend values.

The application calculates metrics such as:

- total invoices
- auto-approved invoices
- invoices requiring review
- automation rate
- average confidence
- estimated hours saved
- estimated savings

The automation-rate calculation excludes invoices still in:

```text
Processing
```

from the completed-invoice denominator.

---

## 12. Failure Handling Test

The application is designed not to generate fake invoice information when AI processing fails.

If Gemini fails:

```text
PDF remains stored
        ↓
No fabricated extraction
        ↓
Processing error shown
        ↓
User can retry
```

This behavior protects the integrity of the workflow.

---

## 13. Gemini Availability Issue

During later end-to-end testing, Gemini repeatedly returned a temporary availability error while processing a PDF.

The user-facing message was:

```text
Gemini is temporarily busy. Please retry processing in a moment.
```

Retry logic was added.

The current implementation retries the Gemini request automatically before presenting the failure state to the user.

If the retries fail:

- the PDF remains stored
- no fake data is generated
- the application displays a controlled error state
- the user can manually retry processing

---

## 14. Important Testing Limitation

The retry implementation successfully passes build/type checking.

However, the exact temporary Gemini overload scenario could not be intentionally reproduced during development.

Therefore, the automatic retry behavior has not yet been fully verified against a controlled live Gemini service-overload event.

Additionally, after adding the final Validation + Risk + Decision Engine, a complete successful real-PDF end-to-end test of the entire latest workflow is still pending.

The intended latest workflow is:

```text
PDF Upload
 ↓
Private Storage
 ↓
Gemini Extraction
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
 ↓
Auto-Approval or Human Review
```

This distinction is documented intentionally rather than presenting an unverified test as successful.

---

## 15. Known Issue Requiring Investigation

The persistent Gemini availability error requires additional diagnosis.

The next diagnostic step is to inspect the actual server-side Gemini API response before the application converts it into the user-friendly error message.

Relevant information to verify includes:

```text
HTTP status code
Gemini error type
Model being used
Rate-limit status
API quota
Model availability
```

Potential categories include:

```text
503 UNAVAILABLE
429 RESOURCE_EXHAUSTED
403 PERMISSION_DENIED
404 MODEL_NOT_FOUND
```

No architectural change should be made until the underlying API error has been identified.

---

## 16. Manual Approval / Rejection

Manual approval and rejection are part of the intended human-in-the-loop workflow.

The desired behavior is:

```text
NEEDS REVIEW
      ↓
Human Review
   /       \
Approve   Reject
  ↓         ↓
Approved  REJECTED
```

The automated engine must never generate `REJECTED`.

Manual actions should preserve:

- original extraction
- validation results
- risk level
- review context

This functionality should be verified with a live database test before being considered production-ready.

---

## 17. Data Integrity Principles

Testing follows several data-integrity principles.

### Never fabricate missing invoice information

If Gemini cannot determine a field, the system should preserve the uncertainty.

### Never interpret AI failure as invoice failure

A Gemini service outage does not mean the invoice itself is invalid.

### Never silently approve processing failures

Unexpected failures should route toward human attention rather than automatic approval.

### Preserve source documents

The uploaded PDF should remain available when downstream processing fails.

---

## 18. Current Test Status

| Component | Status |
|---|---|
| Supabase database integration | Verified |
| Private PDF storage | Verified |
| Gemini PDF extraction | Verified |
| Structured extraction | Verified |
| Extraction → database persistence | Verified |
| Invoice Analysis using extracted data | Verified |
| Validation rules | Verified with controlled inputs |
| Risk rules | Verified with controlled inputs |
| Decision rules | Verified with controlled inputs |
| Review Queue filtering | Verified |
| Dashboard database integration | Verified |
| AI failure fallback | Implemented |
| Gemini retry logic | Implemented, live overload test pending |
| Latest complete PDF → decision flow | Pending successful live retest |
| Manual approval/rejection persistence | Requires final verification |

---

## 19. Production Testing Roadmap

Before a production deployment, testing should be expanded significantly.

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

### Security

Test:

- authentication
- authorization
- organization-level data isolation
- storage permissions
- API-secret exposure
- RLS policies

### Operational Reliability

Test:

- AI provider outages
- API rate limits
- concurrent uploads
- database failures
- storage failures
- retry behavior

---

## 20. Summary

InvoiceAI's testing strategy reflects the architecture of the application.

Different components require different types of testing:

```text
AI Extraction
→ accuracy testing

Validation Engine
→ deterministic rule testing

Risk Engine
→ decision-rule testing

Database
→ persistence testing

Workflow
→ end-to-end testing

External AI API
→ reliability and failure testing
```

The MVP has verified the major individual components and an earlier extraction-to-database workflow.

The final complete end-to-end workflow requires one additional successful live test after the current Gemini availability issue is diagnosed.

Documenting both successful tests and unresolved limitations is part of making the project technically credible.
