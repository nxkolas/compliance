-- Existing-database second pass. Drizzle first materializes the referenced
-- composite UNIQUE constraints; this file then installs their dependent FKs.

alter table public.organization_fact_value_options
  drop constraint if exists organization_fact_value_options_fact_option_fk,
  add constraint organization_fact_value_options_fact_option_fk
  foreign key (fact_key, fact_option_id)
  references public.fact_options (fact_definition_key, id)
  on delete restrict;

alter table public.assessment_answer_options
  drop constraint if exists assessment_answer_options_question_option_fk,
  add constraint assessment_answer_options_question_option_fk
  foreign key (question_id, question_option_id)
  references public.question_options (question_id, id)
  on delete restrict;

alter table public.active_compliance_check_releases
  drop constraint if exists active_compliance_check_releases_identity_fk,
  add constraint active_compliance_check_releases_identity_fk
  foreign key (check_code, check_release_id)
  references public.compliance_check_releases (check_code, id)
  on delete restrict;

alter table public.compliance_check_release_activations
  drop constraint if exists compliance_release_activations_previous_identity_fk,
  drop constraint if exists compliance_release_activations_active_identity_fk,
  add constraint compliance_release_activations_previous_identity_fk
  foreign key (check_code, previous_release_id)
  references public.compliance_check_releases (check_code, id)
  on delete restrict,
  add constraint compliance_release_activations_active_identity_fk
  foreign key (check_code, activated_release_id)
  references public.compliance_check_releases (check_code, id)
  on delete restrict;

alter table public.active_gap_analysis_releases
  drop constraint if exists active_gap_analysis_releases_identity_fk,
  add constraint active_gap_analysis_releases_identity_fk
  foreign key (release_code, gap_analysis_release_id)
  references public.gap_analysis_releases (release_code, id)
  on delete restrict;

alter table public.gap_analysis_release_activations
  drop constraint if exists gap_analysis_release_activations_previous_identity_fk,
  drop constraint if exists gap_analysis_release_activations_active_identity_fk,
  add constraint gap_analysis_release_activations_previous_identity_fk
  foreign key (release_code, previous_release_id)
  references public.gap_analysis_releases (release_code, id)
  on delete restrict,
  add constraint gap_analysis_release_activations_active_identity_fk
  foreign key (release_code, activated_release_id)
  references public.gap_analysis_releases (release_code, id)
  on delete restrict;

alter table public.gap_finding_review_resolutions
  drop constraint if exists gap_finding_review_resolutions_finding_revision_fk,
  add constraint gap_finding_review_resolutions_finding_revision_fk
  foreign key (artifact_revision_id, finding_id)
  references public.gap_findings (artifact_revision_id, id)
  on delete restrict;

alter table public.active_legal_corpus_releases
  drop constraint if exists active_legal_corpus_releases_identity_fk,
  add constraint active_legal_corpus_releases_identity_fk
  foreign key (family_id, release_id)
  references public.legal_corpus_releases (family_id, id)
  on delete restrict;

alter table public.legal_corpus_release_activations
  drop constraint if exists legal_release_activations_release_identity_fk,
  drop constraint if exists legal_release_activations_previous_identity_fk,
  add constraint legal_release_activations_release_identity_fk
  foreign key (family_id, release_id)
  references public.legal_corpus_releases (family_id, id)
  on delete restrict,
  add constraint legal_release_activations_previous_identity_fk
  foreign key (family_id, previous_release_id)
  references public.legal_corpus_releases (family_id, id)
  on delete restrict;
