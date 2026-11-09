-- ═══════════════════════════════════════════════════════════════════════════
-- TypeLake · Migración 5: sin niveles + textos corregidos.
-- Los textos mezclan de todo (tildes, signos, números, símbolos), así que el
-- nivel deja de ser obligatorio. Recarga el banco de textos con mayúsculas correctas.
-- (Borra y vuelve a crear SOLO los textos; no toca alumnos ni intentos.)
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.textos     alter column nivel drop not null;
alter table public.intentos   alter column nivel drop not null;
alter table public.mediciones alter column nivel drop not null;

create or replace function public.registrar_intento(p jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_alumno       perfiles%rowtype;
  v_cfg          configuracion%rowtype;
  v_med          mediciones%rowtype;
  v_modo         text     := 'practica';
  v_nivel        smallint := (p ->> 'nivel')::smallint;
  v_dur          smallint := (p ->> 'duracion_seg')::smallint;
  v_correctos    int      := greatest(0, coalesce((p ->> 'correctos')::int, 0));
  v_incorrectos  int      := greatest(0, coalesce((p ->> 'incorrectos')::int, 0));
  v_pulsaciones  int      := greatest(0, coalesce((p ->> 'pulsaciones')::int, 0));
  v_errores      int      := greatest(0, coalesce((p ->> 'errores')::int, 0));
  v_senales      jsonb    := coalesce(p -> 'senales', '{}'::jsonb);
  v_ppm          numeric;
  v_ppm_bruta    numeric;
  v_precision    numeric;
  v_ref          numeric;
  v_motivos      text[]   := '{}';
  v_estado       text;
  v_similares    int;
  v_id           bigint;
begin
  select * into v_alumno from perfiles where id = auth.uid() and rol = 'alumno' and activo;
  if not found then
    raise exception 'Solo los alumnos pueden registrar intentos';
  end if;
  select * into v_cfg from configuracion;

  if coalesce(trim(p ->> 'codigo'), '') <> '' then
    select * into v_med from mediciones where codigo = upper(trim(p ->> 'codigo'));
    if not found then
      raise exception 'El código de medición no existe';
    end if;
    if now() < v_med.inicia_en or now() > v_med.termina_en + interval '2 minutes' then
      raise exception 'La medición no está abierta en este momento';
    end if;
    if exists (select 1 from mediciones_salones ms where ms.medicion_id = v_med.id)
       and not exists (select 1 from mediciones_salones ms
                       where ms.medicion_id = v_med.id and ms.salon_id = v_alumno.salon_id) then
      raise exception 'Tu salón no participa en esta medición';
    end if;
    v_modo  := 'medicion';
    v_nivel := v_med.nivel;
    v_dur   := v_med.duracion_seg;
  end if;

  -- El nivel ahora es opcional
  if v_nivel is not null and v_nivel not between 1 and 4 then
    raise exception 'Nivel no válido';
  end if;
  if v_dur is null or v_dur not between 15 and 300 then
    raise exception 'Duración no válida';
  end if;

  if exists (select 1 from intentos i
             where i.alumno_id = v_alumno.id
               and i.creado_en > now() - make_interval(secs => v_dur - 5)) then
    raise exception 'Espera a terminar la prueba antes de registrar otra';
  end if;

  v_ppm       := round(v_correctos / 5.0 / (v_dur / 60.0), 1);
  v_ppm_bruta := round((v_correctos + v_incorrectos) / 5.0 / (v_dur / 60.0), 1);
  v_precision := case when v_pulsaciones > 0
                      then round((v_pulsaciones - least(v_errores, v_pulsaciones)) * 100.0 / v_pulsaciones, 1)
                      else 0 end;

  if v_correctos + v_incorrectos > v_pulsaciones then
    v_motivos := array_append(v_motivos, 'datos_inconsistentes');
  end if;
  if v_ppm > v_cfg.ppm_maximo then
    v_motivos := array_append(v_motivos, 'velocidad_imposible');
  end if;
  if (v_senales ->> 'variacionRitmo') is not null
     and (v_senales ->> 'variacionRitmo')::numeric < v_cfg.ritmo_variacion_minima then
    v_motivos := array_append(v_motivos, 'ritmo_robotico');
  end if;
  if coalesce((v_senales ->> 'insercionesMasivas')::int, 0) > 0 then
    v_motivos := array_append(v_motivos, 'insercion_masiva');
  end if;
  if v_modo = 'medicion' and coalesce((v_senales ->> 'salidasPestana')::int, 0) > 0 then
    v_motivos := array_append(v_motivos, 'salio_de_la_pestana');
  end if;

  select percentile_cont(0.5) within group (order by u.ppm) into v_ref
  from (select i.ppm from intentos i
        where i.alumno_id = v_alumno.id and i.estado in ('valido', 'aprobado')
        order by i.creado_en desc
        limit v_cfg.intentos_referencia) u;

  if v_ref is not null
     and v_ppm > greatest(v_ref * v_cfg.sospecha_factor, v_ref + v_cfg.sospecha_margen) then
    select count(*) into v_similares
    from intentos i
    where i.alumno_id = v_alumno.id
      and i.estado = 'sospechoso'
      and i.motivos = array['salto_brusco']
      and i.creado_en > now() - interval '14 days'
      and i.ppm between v_ppm * 0.8 and v_ppm * 1.2;

    if v_similares >= v_cfg.sospecha_repeticiones - 1 then
      update intentos i
         set estado = 'valido', motivos = array['validado_por_repeticion']
       where i.alumno_id = v_alumno.id
         and i.estado = 'sospechoso'
         and i.motivos = array['salto_brusco']
         and i.creado_en > now() - interval '14 days'
         and i.ppm between v_ppm * 0.8 and v_ppm * 1.2;
    else
      v_motivos := array_append(v_motivos, 'salto_brusco');
    end if;
  end if;

  v_estado := case when cardinality(v_motivos) = 0 then 'valido' else 'sospechoso' end;

  insert into intentos (
    alumno_id, salon_id, modo, medicion_id, nivel, duracion_seg,
    ppm, ppm_bruta, precision_pct, correctos, incorrectos, pulsaciones, errores,
    errores_por_tecla, senales, referencia_ppm, estado, motivos
  ) values (
    v_alumno.id, v_alumno.salon_id, v_modo, v_med.id, v_nivel, v_dur,
    v_ppm, v_ppm_bruta, v_precision, v_correctos, v_incorrectos, v_pulsaciones, v_errores,
    coalesce(p -> 'errores_por_tecla', '{}'::jsonb), v_senales, v_ref, v_estado, v_motivos
  )
  returning id into v_id;

  if v_modo = 'medicion' then
    delete from intentos i
    where i.medicion_id = v_med.id
      and i.alumno_id = v_alumno.id
      and i.estado in ('valido', 'aprobado')
      and i.id not in (
        (select x.id from intentos x
          where x.medicion_id = v_med.id and x.alumno_id = v_alumno.id and x.estado in ('valido', 'aprobado')
          order by x.ppm desc, x.id limit 5)
        union
        (select x.id from intentos x
          where x.medicion_id = v_med.id and x.alumno_id = v_alumno.id and x.estado in ('valido', 'aprobado')
          order by x.ppm asc, x.id limit 5)
      );
  end if;

  return jsonb_build_object(
    'id', v_id,
    'estado', v_estado,
    'motivos', to_jsonb(v_motivos),
    'ppm', v_ppm,
    'precision', v_precision,
    'referencia', v_ref,
    'medicion', case when v_modo = 'medicion' then v_med.nombre end
  );
end;
$$;

-- Recargar el banco de textos corregido
delete from public.textos;
insert into public.textos (tema, contenido) values
  ('naturaleza', 'El cóndor andino es una de las aves voladoras más grandes del mundo. Puede planear durante horas sin mover sus alas, aprovechando las corrientes de aire caliente que suben desde los valles.'),
  ('perú', 'En la sierra del Perú se cultivan miles de variedades de papa. Los antiguos pobladores aprendieron a secarlas con el frío de la noche y el sol del día, y así crearon el chuño.'),
  ('perú', 'El lago Titicaca está entre Perú y Bolivia. Es uno de los lagos navegables más altos del planeta, y en sus aguas viven familias que construyen islas flotantes con totora.'),
  ('naturaleza', 'La vicuña vive en las alturas de los Andes. Su lana es muy fina y abrigadora, por eso desde hace mucho tiempo se protege a este animal para que no desaparezca.'),
  ('vida diaria', 'Cada mañana, el panadero del barrio enciende su horno antes de que salga el sol. Cuando abre la puerta, el aroma del pan caliente llena toda la calle.'),
  ('lectura', 'Leer un libro es como viajar sin moverse de la silla. En cada página podemos conocer lugares lejanos, personas valientes y mundos que solo existen en la imaginación.'),
  ('ciencia', 'El corazón humano late unas cien mil veces al día. Es un músculo fuerte que nunca descansa, y para cuidarlo debemos comer sano, dormir bien y hacer ejercicio.'),
  ('naturaleza', 'La Amazonía peruana es un bosque enorme lleno de vida. Allí habitan monos, guacamayos, delfines rosados y miles de plantas que todavía estamos aprendiendo a conocer.'),
  ('fábula', 'Una pequeña hormiga encontró una semilla y la llevó hasta su casa. Aunque era más grande que ella, no se rindió, porque sabía que el esfuerzo diario trae buenos frutos.'),
  ('ciencia', 'La Luna no tiene luz propia. Lo que vemos brillar en la noche es la luz del Sol que se refleja en su superficie, llena de cráteres y montañas.'),
  ('valores', 'En el colegio aprendemos a trabajar en equipo. Cuando cada uno aporta una idea, el resultado final es mejor que el que lograríamos solos.'),
  ('valores', 'El agua es un recurso valioso que no debemos desperdiciar. Cerrar el caño mientras nos cepillamos los dientes es un pequeño gesto que ayuda mucho.'),
  ('perú', 'Machu Picchu fue construida hace más de quinientos años en lo alto de una montaña. Sus muros de piedra encajan tan bien que no necesitan ningún tipo de mezcla.'),
  ('vida diaria', 'Mi abuela guarda sus recetas en un cuaderno viejo. Cada página tiene manchas de harina y de chocolate, y cuenta la historia de una comida especial en familia.'),
  ('naturaleza', 'Las abejas visitan cientos de flores en un solo día. Gracias a ellas, muchas plantas pueden dar frutos, y nosotros podemos disfrutar de manzanas, fresas y paltas.'),
  ('arte', 'Practicar un instrumento musical requiere paciencia. Al principio los sonidos parecen desordenados, pero con el tiempo los dedos encuentran el camino correcto.'),
  ('cuento', 'El niño miró por la ventana y vio que la lluvia había terminado. Salió corriendo al jardín, saltó en los charcos y descubrió un arcoíris sobre los cerros.'),
  ('naturaleza', 'La tortuga marina recorre miles de kilómetros en el océano. Cuando llega el momento, vuelve a la misma playa donde nació para dejar sus huevos en la arena.'),
  ('valores', 'Un buen amigo escucha con atención, comparte lo que tiene y te acompaña tanto en los días felices como en los días difíciles.'),
  ('perú', 'En la costa del Perú casi nunca llueve, pero en invierno aparece una neblina húmeda que cubre la ciudad. Los limeños la llaman garúa cuando cae como una lluvia muy fina.'),
  ('perú', '¿Sabías que el Perú tiene una enorme variedad de climas? En un solo día puedes pasar del calor del desierto al frío de la puna; por eso se dice que es un país de contrastes.'),
  ('cuento', '¡Qué gran sorpresa se llevó Lucía! Al abrir la caja encontró un pequeño telescopio. Esa misma noche, desde la azotea de su casa, observó por primera vez los anillos de Saturno.'),
  ('naturaleza', 'El río Amazonas nace en los Andes del Perú y desemboca en el océano Atlántico. ¿Te imaginas el largo viaje que hace una gota de agua desde la montaña hasta el mar?'),
  ('historia', 'Los incas no conocían la escritura como la entendemos hoy; sin embargo, usaban los quipus, cordones con nudos que servían para llevar cuentas y guardar información.'),
  ('ciencia', '¿Por qué el cielo es azul? La luz del Sol está formada por muchos colores; al atravesar el aire, el color azul se dispersa más que los otros y llena todo el cielo.'),
  ('valores', '¡No te rindas! Cada error es una oportunidad para aprender algo nuevo. Los grandes inventores fallaron muchas veces antes de lograr lo que buscaban.'),
  ('literatura', 'Ricardo Palma escribió las Tradiciones peruanas, un conjunto de relatos llenos de humor e historia. Gracias a él, muchas leyendas de Lima llegaron hasta nuestros días.'),
  ('naturaleza', 'El pingüino de Humboldt vive en las costas del Perú y de Chile. Aunque no puede volar, es un nadador excelente; bajo el agua parece que vuela entre las olas.'),
  ('imaginación', '¿Qué harías si pudieras viajar en el tiempo? Algunos visitarían a los dinosaurios; otros preferirían conocer el futuro y descubrir cómo serán las ciudades.'),
  ('perú', 'Arequipa es conocida como la Ciudad Blanca. Muchas de sus casonas e iglesias fueron construidas con sillar, una piedra volcánica de color claro que brilla con el sol.'),
  ('colegio', '¡Atención, equipo! Mañana es la feria de ciencias. Revisen sus maquetas, preparen sus carteles y practiquen la explicación; el jurado hará muchas preguntas.'),
  ('ciencia', 'La Tierra gira sobre sí misma y, al mismo tiempo, da vueltas alrededor del Sol. El primer movimiento produce el día y la noche; el segundo, junto con la inclinación del planeta, las estaciones.'),
  ('literatura', 'César Vallejo nació en Santiago de Chuco, en La Libertad. Es considerado uno de los poetas más importantes de la lengua española, y sus versos se leen en todo el mundo.'),
  ('perú', '¿Cuál es tu comida favorita? Para muchos peruanos, el ceviche ocupa el primer lugar; para otros, nada supera un buen ají de gallina o un lomo saltado.'),
  ('naturaleza', 'Durante la noche, el desierto de Ica se vuelve silencioso y frío. ¡Cuántas estrellas se pueden ver lejos de las luces de la ciudad!'),
  ('cuento', 'Mi hermano menor siempre pregunta lo mismo: ¿por qué? ¿Por qué llueve? ¿Por qué los gatos ronronean? Mamá dice que esa curiosidad lo convertirá en científico.'),
  ('perú', 'El nevado Huascarán (Áncash) es la montaña más alta del Perú: alcanza unos 6768 metros sobre el nivel del mar y forma parte de la Cordillera Blanca.'),
  ('historia', 'El 28 de julio de 1821, José de San Martín proclamó la independencia del Perú en Lima. Por eso, cada año celebramos las Fiestas Patrias con desfiles, música y comida típica.'),
  ('lectura', 'Según la profesora, "leer 20 minutos al día" puede cambiar tu vida: en un año sumarías más de 7000 minutos de lectura (¡casi 122 horas!).'),
  ('vida diaria', 'La receta de la abuela dice: 2 tazas de harina, 3 huevos, 1 taza de azúcar y 250 gramos de mantequilla. El horno debe estar a 180 grados durante 35 minutos.'),
  ('ciencia', 'El sistema solar tiene 8 planetas: Mercurio, Venus, la Tierra, Marte, Júpiter, Saturno, Urano y Neptuno. Plutón fue considerado el noveno planeta hasta el año 2006.'),
  ('lenguaje', 'La palabra "chacra" viene del quechua y significa terreno de cultivo. Otras palabras de origen quechua que usamos a diario son "cancha", "choclo" y "palta".'),
  ('colegio', 'El partido de vóley terminó 3-2. Al final, la capitana dijo: "Ganamos porque nunca dejamos de animarnos" (y todo el coliseo aplaudió de pie).'),
  ('perú', 'Las líneas de Nasca (en Ica) fueron trazadas hace unos 2000 años. Algunas figuras, como el colibrí o el mono, miden más de 90 metros y solo se aprecian bien desde el aire.'),
  ('matemática', 'Un año tiene 365 días, 52 semanas y 12 meses. Cada 4 años hay un año bisiesto (de 366 días), en el que febrero tiene 29 días en lugar de 28.'),
  ('colegio', 'El horario de mañana es: Matemática (8:00 - 9:30), Comunicación (9:45 - 11:15) y Educación Física (11:30 - 13:00). ¡No olvides tu buzo!'),
  ('lenguaje', 'Se escribe "por qué" separado y con tilde cuando preguntamos, y "porque" junto cuando respondemos. Por ejemplo: -¿Por qué llegaste tarde? -Porque perdí el bus.'),
  ('naturaleza', 'Muchos colibríes baten sus alas entre 50 y 80 veces por segundo (¡más rápido de lo que podemos ver!). Además, pueden quedarse quietos en el aire e incluso volar hacia atrás.'),
  ('matemática', 'En la tienda escolar, un cuaderno cuesta S/ 4.50 y un lapicero S/ 1.20. Si compras 3 cuadernos y 2 lapiceros, pagarás S/ 15.90 en total.'),
  ('colegio', 'La encuesta del aula mostró que el 45% prefiere el fútbol, el 30% el vóley y el 25% restante otros deportes como natación o atletismo.'),
  ('colegio', 'Para inscribirte en el taller, escribe a talleres@ejemplo.edu.pe con el asunto "Inscripción #2026" e indica tu nombre, grado y sección.'),
  ('matemática', 'El lunes el dólar estaba a S/ 3.75 y el viernes subió a S/ 3.80. ¿Cuántos soles más cuesta comprar $ 20 el viernes que el lunes?'),
  ('matemática', 'La librería "Pérez & Hijos" ofrece un 20% de descuento en útiles escolares: una mochila de S/ 80.00 queda en S/ 64.00.'),
  ('colegio', 'En las redes del colegio usamos el hashtag #LeerEsCrecer. Este mes se publicaron 120 fotos y el 75% fueron de la feria del libro.'),
  ('matemática', 'La fracción 3/4 equivale al 75% y la fracción 1/2 equivale al 50%. Si un pastel se divide en 8 partes y comes 2, ¿qué porcentaje del pastel comiste?'),
  ('matemática', 'El pasaje de bus cuesta S/ 2.50; con el carné escolar pagas el 50%, es decir, S/ 1.25. En 20 días de clase (ida y vuelta) ahorrarías S/ 50.00.'),
  ('tecnología', 'Una contraseña segura combina mayúsculas, minúsculas, números y símbolos como @, #, $ o &. Nunca compartas tu clave con nadie (¡ni siquiera con tu mejor amigo!).'),
  ('matemática', 'Informe de la kermés: ventas = S/ 1250.00; gastos = S/ 430.00; ganancia = S/ 820.00, es decir, el 65.6% de lo vendido.'),
  ('ciencia', 'Inventario del laboratorio: 24 microscopios, 12 balanzas y 36 tubos de ensayo. El 25% de los tubos necesita reemplazo, o sea, 9 tubos en total.');
