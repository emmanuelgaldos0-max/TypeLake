-- TypeLake · Migración 7: permitir intentos importados desde Excel.
-- Las notas históricas solo traen las PPM, no la precisión, así que esta pasa a ser opcional.
alter table public.intentos alter column precision_pct drop not null;
