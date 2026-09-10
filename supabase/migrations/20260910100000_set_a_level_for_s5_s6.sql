-- In a Ugandan secondary school, S.1-S.4 are O-Level and S.5-S.6 are A-Level.
-- Correct existing class records whose level was left at the default.
update public.classes
set education_level = 'advanced'
where upper(regexp_replace(trim(name), '\\s+', '', 'g')) ~ '^S\\.?[56](\\b|-|\\()';

update public.classes
set education_level = 'ordinary'
where upper(regexp_replace(trim(name), '\\s+', '', 'g')) ~ '^S\\.?[1-4](\\b|-|\\()';
