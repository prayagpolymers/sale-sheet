# Prayag Sales & Accounting Portal

## Data sources
1. Sales workbook:
   `1QIpcfgOVCFjcCmgU_DXKn8h7Bfa8rm2q2wB2HneTvKs`
   Tab: `Sheet1`

2. Accounting workbook:
   `1oHFpXqVDPRF3Vi3WV9MdNcxkHNjgytLPxXUQgM6o1ok`
   Tabs:
   - SALE RETURN
   - CN SAP
   - DN SAP
   - DEBTOR

## Accounting rules implemented
- SALE = Debit
- SALE is treated as taxable amount + 18% GST
- DN SAP = Debit; GST already included
- CN SAP = Credit; GST already included
- SALE RETURN = Credit; GST already included
- DEBTOR / Payment = Credit
- Outstanding = Sales incl. GST + DN - Payment - CN - Sales Return
- Ageing uses FIFO allocation of credits against oldest debit entries.

## GitHub Pages
Upload `index.html`, `style.css`, `script.js` to the root of the GitHub repository.
Enable Settings → Pages → Deploy from branch → main → root.

## Google Sheets
Both workbooks must be shared:
Anyone with the link → Viewer

## Important
The login in this prototype is a role/data filter, not secure authentication. Before giving access to real parties/state heads, connect Firebase Authentication (or another backend) and enforce server-side row-level access. Do not publish passwords in HTML/JavaScript.
