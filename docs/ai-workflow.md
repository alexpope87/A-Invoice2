# InvoiceAI — AI Workflow

## 1. Overview

InvoiceAI uses Generative AI as a document-understanding component within a broader deterministic automation workflow.

The AI model is responsible for converting an unstructured invoice PDF into structured data.

It is not responsible for making the final operational decision.

The core principle is:

```text
AI extracts
    ↓
Rules validate
    ↓
Risk engine classifies
    ↓
Decision engine routes
    ↓
Humans handle exceptions
```

This separation makes the workflow easier to understand, test and control.

---

## 2. Why AI Is Used

Invoices are semi-structured documents.

The same information can appear:

- in different positions
- under different labels
- in tables
- in different layouts
- with different formatting
- across different suppliers

Traditional fixed extraction rules can therefore become difficult to maintain across many document formats.

A multimodal AI model can interpret the document and transform relevant information into a consistent structure.

InvoiceAI uses Google Gemini for this task.

---

## 3. Input

The workflow starts with a PDF invoice uploaded by the user.

```text
User
 ↓
PDF Invoice
 ↓
InvoiceAI
```

The PDF is stored in a private Supabase Storage bucket.

The application keeps the original document so that the extracted information can be compared with its source.

---

## 4. Secure AI Request

The browser does not call Gemini directly.

Instead:

```text
Browser
   ↓
Server-side endpoint
   ↓
Private Supabase Storage
   ↓
Google Gemini API
```

The Gemini API key is stored as a server-side secret.

This prevents the API credential from being exposed in browser code.

The server-side endpoint receives information identifying the invoice and the PDF storage path, retrieves the document and sends it to Gemini for processing.

---

## 5. AI Extraction

Gemini analyzes the PDF and extracts structured invoice information.

The target information includes fields such as:

```json
{
  "supplier_name": "ACME Supplies S.r.l.",
  "invoice_number": "INV-2026-9001",
  "invoice_date": "2026-03-14",
  "due_date": "2026-04-13",
  "subtotal": 1200.00,
  "vat": 264.00,
  "total": 1464.00,
  "currency": "EUR",
  "category": "Office Furniture",
  "confidence_score": 98
}
```

This converts an unstructured business document into data that conventional software can process.

---

## 6. Structured Output

Structured output is important because downstream application logic should not depend on free-form AI text.

For example, this response would be difficult to process reliably:

```text
The invoice appears to be from ACME Supplies.
The total seems to be around €1,464 and the VAT is probably €264.
```

Instead, InvoiceAI expects structured fields:

```json
{
  "supplier_name": "ACME Supplies S.r.l.",
  "total": 1464.00,
  "vat": 264.00,
  "currency": "EUR"
}
```

The structured result can then be:

- stored in the database
- validated
- displayed in the UI
- used by deterministic business rules
- searched and filtered
- included in operational reporting

---

## 7. Missing Information

The AI should not invent information that is not present or cannot be reliably read from the document.

The intended behavior is:

```text
Information available
→ Extract value

Information unavailable
→ Return null / missing value
```

For example:

```json
{
  "due_date": null
}
```

is preferable to generating a plausible but unsupported due date.

This principle reduces the risk of fabricated data entering downstream business logic.

---

## 8. Confidence Score

The extraction result includes an AI confidence score.

Conceptually:

```text
High confidence
→ extraction appears reliable

Medium confidence
→ additional caution

Low confidence
→ human review required
```

In the MVP, confidence is used as one input to the deterministic risk engine.

Current decision thresholds are:

```text
90–100
→ eligible for LOW risk

70–89
→ MEDIUM risk

Below 70
→ HIGH risk
```

Confidence alone does not determine whether an invoice is automatically processed.

Validation results are also considered.

---

## 9. Persistence

After successful extraction, the structured data is stored in Supabase/PostgreSQL.

The workflow therefore moves from:

```text
PDF
```

to:

```text
PDF
+
Structured Database Record
```

The original PDF remains stored separately in Supabase Storage.

This allows the application to retain both:

- source document
- machine-readable information

---

## 10. Deterministic Validation

After AI extraction, InvoiceAI switches from probabilistic AI processing to deterministic application logic.

Examples include:

### Required Fields

```text
supplier_name present?
invoice_number present?
invoice_date present?
total present?
currency present?
```

### Total Calculation

```text
subtotal + VAT ≈ total
```

### Date Logic

```text
due_date >= invoice_date
```

### Amount Sanity

```text
Are monetary values valid and non-negative?
```

The validation engine produces:

```text
PASS
FAIL
NOT_CHECKED
```

---

## 11. Why NOT_CHECKED Exists

A missing value is not always the same as a failed validation.

For example, if the invoice does not provide enough information to verify a calculation:

```text
subtotal = null
VAT = null
total = €500
```

InvoiceAI should not claim:

```text
Total calculation = FAIL
```

because the calculation was never possible.

Instead:

```text
Total calculation = NOT_CHECKED
```

This distinction is important for transparent decision-making.

---

## 12. Risk Classification

After validation, deterministic rules combine:

- AI confidence
- validation failures
- missing information
- checks that could not be completed

to classify the invoice.

Possible values are:

```text
LOW
MEDIUM
HIGH
```

Example:

```text
Confidence: 98
Required fields: PASS
Total calculation: PASS
Dates: PASS
Amount sanity: PASS

        ↓

Risk: LOW
```

Another example:

```text
Confidence: 96
Total calculation: FAIL

        ↓

Risk: HIGH
```

---

## 13. Decision Engine

Risk classification determines the operational route.

```text
LOW
 ↓
AUTO-APPROVED
```

```text
MEDIUM
 ↓
NEEDS REVIEW
```

```text
HIGH
 ↓
NEEDS REVIEW
```

A high-risk invoice is not automatically rejected.

The system identifies uncertainty or inconsistency and sends the invoice to a person.

---

## 14. Human Review

Invoices with status:

```text
NEEDS REVIEW
```

appear in the Review Queue.

The operator can inspect:

- original invoice information
- extracted fields
- AI confidence
- validation results
- risk level
- reason for review

The human operator can then make the final decision.

This is the human-in-the-loop component of InvoiceAI.

---

## 15. Why AI Does Not Approve or Reject Invoices

InvoiceAI intentionally avoids asking Gemini questions such as:

```text
"Should this invoice be approved?"
```

Instead, Gemini is asked to answer questions such as:

```text
"What is the invoice number?"

"What is the total?"

"What is the invoice date?"
```

The difference is important.

Document interpretation benefits from AI.

Mathematical validation and predefined business policies can be handled more predictably with conventional software.

The architecture therefore separates:

```text
Probabilistic task
→ AI

Deterministic task
→ Code

Exception decision
→ Human
```

---

## 16. Example — Successful Automated Invoice

### AI Extraction

```json
{
  "supplier_name": "ACME Supplies S.r.l.",
  "invoice_number": "INV-2026-9001",
  "invoice_date": "2026-03-14",
  "subtotal": 1200,
  "vat": 264,
  "total": 1464,
  "currency": "EUR",
  "confidence_score": 98
}
```

### Validation

```text
Required fields      PASS
Total calculation    PASS
Date validation      PASS
Amount sanity        PASS
```

### Risk

```text
LOW
```

### Decision

```text
AUTO-APPROVED
```

No human intervention is required in the MVP workflow.

---

## 17. Example — Exception

Assume Gemini extracts:

```json
{
  "subtotal": 1200,
  "vat": 264,
  "total": 1500,
  "confidence_score": 96
}
```

The deterministic calculation is:

```text
1200 + 264 = 1464
```

but:

```text
invoice total = 1500
```

Therefore:

```text
Total Calculation
→ FAIL

Risk
→ HIGH

Decision
→ NEEDS REVIEW

Reason
→ Invoice total does not match subtotal + VAT.
```

The system does not reject the invoice.

A human investigates the discrepancy.

---

## 18. Error Handling

AI APIs are external services and can temporarily fail or become rate-limited.

InvoiceAI therefore avoids treating an AI service failure as a business decision.

If Gemini cannot process the document:

```text
AI processing failure
        ↓
No fabricated data
        ↓
PDF remains stored
        ↓
User can retry processing
```

The current implementation distinguishes between different upstream failures.

For temporary `503 UNAVAILABLE` responses, the system performs one controlled retry after a short delay.

For `429 RESOURCE_EXHAUSTED` responses, the system does not automatically retry repeatedly, avoiding unnecessary requests while the API quota is exhausted.

If extraction ultimately fails:

- extracted data is not fabricated
- validation and decision logic do not run on invented data
- the original PDF remains stored
- the invoice record is preserved
- the user receives an appropriate processing message
- processing can be retried later

This keeps AI infrastructure failures separate from invoice validation failures.

---

## 19. AI Service Reliability

During development, Gemini occasionally returned temporary `503 UNAVAILABLE` responses and API quota (`429`) errors while processing PDFs.

These cases were used to improve the application's failure-handling strategy.

The Gemini integration was subsequently configured to use `gemini-3.5-flash-lite`, and the complete PDF processing workflow was successfully validated end-to-end.

External AI availability remains a dependency of the system, so a production architecture could additionally introduce:

- asynchronous processing
- job queues
- monitoring and alerting
- provider/model fallback
- more advanced retry and backoff strategies

AI service availability is treated as an infrastructure concern rather than an invoice validation failure.
---

## 20. AI Cost Considerations

InvoiceAI uses an external AI API only for document understanding.

This architecture makes AI usage measurable.

A production system could track:

```text
AI processing cost per invoice
```

and compare it with:

```text
manual processing cost avoided per invoice
```

This enables a more complete automation ROI calculation.

The current MVP uses Google Gemini and is designed for low-volume portfolio/demo testing rather than production-scale processing.

---

## 21. End-to-End Workflow

The complete intended workflow is:

```text
1. Upload invoice PDF

2. Store PDF privately

3. Create invoice record

4. Send PDF to Gemini through server-side endpoint

5. Extract structured information

6. Save extracted information

7. Run deterministic validations

8. Save validation results

9. Calculate risk

10. Determine operational status

11. Display Invoice Analysis

12. Auto-process clear invoices

13. Send exceptions to Review Queue

14. Human reviews uncertain invoices

15. Human makes final exception decision
```

---

## 22. Summary

InvoiceAI does not treat Generative AI as an autonomous decision-maker.

It uses AI for the task where it provides the most value:

**understanding unstructured documents.**

The rest of the workflow uses deterministic rules and human oversight.

The resulting design can be summarized as:

```text
DOCUMENT
   ↓
AI UNDERSTANDING
   ↓
STRUCTURED DATA
   ↓
DETERMINISTIC VALIDATION
   ↓
RISK & ROUTING
   ↓
AUTOMATION OR HUMAN REVIEW
```

This approach combines the flexibility of Generative AI with the predictability of conventional business logic.
