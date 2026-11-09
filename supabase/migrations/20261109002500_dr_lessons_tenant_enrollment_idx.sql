-- Covering index for the tenant-scoped foreign key to enrollments.
create index dr_lessons_tenant_enrollment_idx on public.dr_lessons (tenant_id, enrollment_id);
