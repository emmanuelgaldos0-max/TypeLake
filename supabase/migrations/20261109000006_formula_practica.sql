-- TypeLake · Migración 6: fórmula visible para alumnos basada en todos los intentos válidos.
-- Permite que el dashboard muestre el promedio de cada salón antes de la primera medición.
insert into public.formulas_promedio (nombre, tipo, fuente, sin_intentos, visible_alumnos)
select 'Promedio de práctica', 'general', 'todo', 'ignorar', true
where not exists (select 1 from public.formulas_promedio where nombre = 'Promedio de práctica');
