DELETE FROM public.grading_scales
WHERE school_id = '11111111-1111-1111-1111-111111111111'
  AND grade IN ('A+','A','B','C','D','E');

INSERT INTO public.grading_scales (school_id, grade, min_score, max_score, descriptor, identifier)
VALUES
('11111111-1111-1111-1111-111111111111','A',80,100,'Achieved MOST or ALL competencies exceedingly well.',3),
('11111111-1111-1111-1111-111111111111','B',70,79,'Very Good performance.',2),
('11111111-1111-1111-1111-111111111111','C',60,69,'Achieved a good number of competencies.',2),
('11111111-1111-1111-1111-111111111111','D',50,59,'Basic competency achieved.',1),
('11111111-1111-1111-1111-111111111111','E',0,49,'Archieved a minimum level of competency achieved',1);
