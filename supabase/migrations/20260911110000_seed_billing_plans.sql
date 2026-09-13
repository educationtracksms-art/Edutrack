-- Official EduTrack school-management billing catalogue.
-- display_order is intentionally independent from price because the product
-- order is Monthly -> Annual -> Termly.
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS display_order int NOT NULL DEFAULT 99;

UPDATE public.subscription_plans
SET
  name = 'Monthly',
  price = 100000,
  billing_cycle = 'monthly',
  description = 'School Management System access billed every month.',
  display_order = 1,
  is_active = true
WHERE name = 'Standard';

INSERT INTO public.subscription_plans (
  name, price, billing_cycle, description, display_order, is_active
)
VALUES
  (
    'Monthly',
    100000,
    'monthly',
    'School Management System access billed every month.',
    1,
    true
  ),
  (
    'Annual',
    1500000,
    'annual',
    '12 months of School Management System access at UGX 1,500,000.',
    2,
    true
  ),
  (
    'Termly',
    500000,
    'termly',
    'One school term of School Management System access.',
    3,
    true
  )
ON CONFLICT (name) DO UPDATE SET
  price = EXCLUDED.price,
  billing_cycle = EXCLUDED.billing_cycle,
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

-- Keep the legacy denormalized school field readable for older platform
-- reports; normalized school_subscriptions remains the source of truth.
UPDATE public.schools s
SET subscription_plan = p.name
FROM public.school_subscriptions ss
JOIN public.subscription_plans p ON p.id = ss.plan_id
WHERE ss.school_id = s.id
  AND ss.status IN ('trial', 'active', 'past_due');
