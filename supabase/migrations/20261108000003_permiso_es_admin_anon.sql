-- La política "leer textos activos" (para practicar sin cuenta) llama a es_admin().
-- Los visitantes anónimos necesitan poder ejecutarla; para ellos siempre devuelve false.
grant execute on function public.es_admin() to anon;
