# InvoiceAI

**AI-powered invoice processing and decision automation MVP**

A functional portfolio MVP that explores how Generative AI can automate invoice processing while combining AI extraction, deterministic business rules and human oversight.

Built independently to explore the complete process of turning a business problem into a working AI-enabled application: **workflow design → rapid prototyping → AI integration → validation → testing → iteration.**

### 🔗 Project Links

**Live Demo:** [Add URL]  
**GitHub:** https://github.com/alexpope87/A-Invoice2  
**Documentation:** See the `/docs` folder

---

## 🚀 What I Built

I designed and developed InvoiceAI as an end-to-end AI automation MVP.

The project includes:

- PDF invoice upload and private document storage
- AI-powered structured data extraction using Google Gemini
- deterministic validation rules
- risk classification and automated routing
- human review workflow for exceptions
- manual approval and rejection
- error handling and API retry logic
- invoice history and detailed processing results
- KPI and automation dashboard
- end-to-end testing across successful and exception scenarios

The objective was not simply to integrate an LLM, but to design a **reliable business workflow around AI**, where AI handles document understanding while deterministic rules and human oversight control business decisions.

---

## 📸 Demo

### Dashboard
*[Insert dashboard screenshot]*

### AI Extraction & Validation
*[Insert invoice detail screenshot]*

### Human Review Queue
*[Insert review queue screenshot]*

---

## 🔄 How It Works

```text
Invoice PDF
      ↓
Google Gemini
      ↓
Structured Data Extraction
      ↓
Deterministic Validation
      ↓
Risk Classification
      ↓
Decision Engine
      ↓
LOW RISK ─────────→ AUTO-APPROVED
MEDIUM/HIGH RISK ─→ HUMAN REVIEW
                           ↓
                    APPROVE / REJECT
```

**AI extracts → rules validate → system routes → humans handle exceptions.**

Gemini does not autonomously approve or reject invoices. The LLM is used for document understanding, while deterministic business rules control automated routing and final rejection remains a human decision.

---

## 🎯 Business Problem
## 🎯 Business Problem

Invoice processing often requires employees to manually:

- read invoice documents
- enter invoice data into internal systems
- verify amounts and dates
- identify inconsistencies
- decide which invoices require further review

These repetitive activities consume operational time and make invoice processing difficult to scale.

## 💡 Solution

InvoiceAI automates the workflow:

**PDF Upload → AI Extraction → Validation → Risk Assessment → Automated Decision → Human Review for Exceptions**

The key design principle is the separation between AI and business decision-making.

Google Gemini is used to **extract information from documents**, while deterministic business rules validate the extracted data and determine whether an invoice can be automatically processed or requires human review.

## ✨ Key Features

- PDF invoice upload
- AI-powered document extraction with Google Gemini
- Structured extraction of supplier, invoice number, dates, amounts, VAT and currency
- Deterministic invoice validation
- AI confidence tracking
- Risk classification
- Automatic routing of low-risk invoices
- Human review queue for exceptions
- Manual approval/rejection workflow
- Invoice history
- KPI and automation dashboard
- Private document storage

## 🧠 AI & Decision Workflow

The application deliberately separates AI extraction from business decisions.

```text
Invoice PDF
    ↓
Google Gemini
    ↓
Structured Data Extraction
    ↓
Deterministic Validation
    ↓
Risk Classification
    ↓
Decision Engine
    ↓
LOW RISK ─────────→ AUTO-APPROVED
MEDIUM/HIGH RISK ─→ HUMAN REVIEW
```

Gemini does **not** decide whether an invoice should be approved or rejected.

The AI reads and structures the document. Business rules make the operational routing decision.

Final rejection remains a human decision.

## 🏗️ Tech Stack

| Component | Technology |
|---|---|
| Application / UI | React / TanStack |
| Development Platform | Lovable |
| Database | Supabase / PostgreSQL |
| File Storage | Supabase Storage |
| AI Document Processing | Google Gemini API |
| Backend AI Integration | Server-side API route |
| Version Control | GitHub |

## 🔍 Validation Engine

After AI extraction, deterministic rules verify the invoice.

Current validation checks include:

- required fields
- subtotal + VAT vs total consistency
- invoice and due-date consistency
- VAT information
- amount sanity checks

Validation results can be:

- `PASS`
- `FAIL`
- `NOT_CHECKED`

`NOT_CHECKED` is used when there is insufficient information to reliably perform a validation.

## ⚙️ Risk & Decision Engine

The MVP uses three risk levels:

### LOW

High extraction confidence and required validation checks pass.

→ `AUTO-APPROVED`

### MEDIUM

The invoice contains uncertainty, such as moderate AI confidence or validation checks that could not be completed.

→ `NEEDS REVIEW`

### HIGH

Important validation checks fail or extraction confidence is too low.

→ `NEEDS REVIEW`

The automated system never rejects an invoice. `REJECTED` remains a manual human decision.

## 👤 Human-in-the-Loop

InvoiceAI is designed to automate clear cases while escalating uncertain cases.

Instead of allowing the LLM to make financial approval decisions autonomously:

**AI extracts → rules validate → system routes → humans handle exceptions.**

This makes the workflow more transparent and auditable.

## 📊 Business Impact

The dashboard tracks:

- invoices processed
- auto-approved invoices
- invoices requiring review
- automation rate
- average AI confidence
- estimated processing hours saved
- estimated operational savings

For the MVP, estimated productivity benefits use demo assumptions:

- **8 minutes** of manual processing saved per auto-approved invoice
- **€25/hour** illustrative operational cost

These figures are assumptions used to demonstrate how ROI could be measured and are **not measured production savings**.

## 🔐 Security Approach

The MVP includes several basic security principles:

- invoice PDFs are stored in a private Supabase Storage bucket
- the Gemini API key is stored server-side
- API credentials are never exposed to the browser
- Supabase Row Level Security (RLS) is enabled
- development uses synthetic/demo invoice data

> The current RLS configuration is designed for an MVP/demo environment and would require authenticated, user-specific policies before production deployment.

## ⚠️ Current Limitations

InvoiceAI is a portfolio MVP rather than a production accounting system.

Current limitations include:

- no production authentication/user-management system
- simplified validation and risk rules
- business rules are not yet configurable by organization
- no ERP/accounting-system integration
- no purchase-order matching
- no duplicate invoice detection
- Gemini service availability can temporarily affect document processing
- development RLS policies are not production-ready

## 🚀 Potential Next Steps

Possible production-oriented improvements include:

- authentication and organization-level permissions
- supplier master-data matching
- duplicate invoice detection
- purchase-order matching
- configurable approval policies
- complete audit trail
- ERP/accounting integrations
- advanced exception management
- production-grade monitoring

## 📚 Project Documentation

- [Business Case & ROI](docs/business-case.md)
- [System Architecture](docs/architecture.md)
- [AI Workflow](docs/ai-workflow.md)
- [Testing & Validation](docs/testing.md)
  ## ✅ Validation Status

The core workflow has been tested end-to-end using a real invoice PDF:

**PDF Upload → Gemini Extraction → Database Persistence → Deterministic Validation → Risk Classification → Automated Decision**

A successful test produced a `LOW RISK → AUTO-APPROVED` decision after all validation checks passed.

The exception workflow was also tested through the Review Queue, where a `HIGH RISK → NEEDS REVIEW` invoice was manually rejected by a human reviewer.

See [Testing & Validation](docs/testing.md) for the complete test scenarios.

## 📌 Project Status

**MVP / Portfolio Project**

Core workflow:

**PDF → AI Extraction → Validation → Risk Assessment → Decision → Human Review**

The project was built to demonstrate the design of an AI-enabled business process, combining Generative AI, deterministic automation, exception handling and human oversight.
