# Recordly secure payment update

This update ports the server-authoritative payment flow from the latest Recordly Pro frontend into the original Recordly frontend.

Changes in `index.html`:
- Payment creation now calls `rc_log_payment()` for owners and staff.
- Legacy payment synchronisation now calls `rc_log_payment()` instead of direct `payments` table upserts.
- Payment edits now call `rc_edit_payment()` and pass `new_proof_path`; the direct proof-path UPDATE was removed.
- The edit button now has the ID used by the save handler.

Important: this frontend expects the existing Supabase RPC functions from the Pro SQL already applied to your shared Supabase project. Do not change payment table grants until this frontend has been deployed and tested. Test with a small non-critical group first.
