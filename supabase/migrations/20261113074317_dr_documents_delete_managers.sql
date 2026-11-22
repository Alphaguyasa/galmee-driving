-- Only owners and managers may remove a student's document record.
-- Staff can still add documents and mark them received.
drop policy if exists dr_documents_del on public.dr_documents;
create policy dr_documents_del on public.dr_documents
  for delete to authenticated
  using (
    tenant_id = (select private.current_tenant())
    and (select private.current_app_role()) in ('owner', 'manager')
  );
