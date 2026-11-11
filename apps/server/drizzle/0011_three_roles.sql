-- Workflow Creator and Technical Operator are merged into one role, Workflow Builder.
UPDATE "users" SET "role" = 'workflow_builder' WHERE "role" IN ('workflow_creator', 'technical_operator');
