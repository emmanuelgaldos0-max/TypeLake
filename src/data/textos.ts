// Banco de textos inicial de TypeLake.
// No hay niveles: cada prueba mezcla fragmentos al azar, así que un texto puede
// traer tildes, ñ, mayúsculas, ¿? ¡!, números, comillas, paréntesis y símbolos
// ($ % @ & / # =). Todos los fragmentos están correctamente escritos.
//
// Más adelante el banco se editará desde el panel de administración.
//
// Reglas: solo caracteres que se escriben con teclado latinoamericano,
// comillas rectas ("), guion simple (-), sin espacios dobles.

export interface Fragmento {
  tema: string;
  texto: string;
}

export const FRAGMENTOS: Fragmento[] = [
  // ───────────── Tildes, ñ, comas y puntos ─────────────
  { tema: "naturaleza", texto: "El cóndor andino es una de las aves voladoras más grandes del mundo. Puede planear durante horas sin mover sus alas, aprovechando las corrientes de aire caliente que suben desde los valles." },
  { tema: "perú", texto: "En la sierra del Perú se cultivan miles de variedades de papa. Los antiguos pobladores aprendieron a secarlas con el frío de la noche y el sol del día, y así crearon el chuño." },
  { tema: "perú", texto: "El lago Titicaca está entre Perú y Bolivia. Es uno de los lagos navegables más altos del planeta, y en sus aguas viven familias que construyen islas flotantes con totora." },
  { tema: "naturaleza", texto: "La vicuña vive en las alturas de los Andes. Su lana es muy fina y abrigadora, por eso desde hace mucho tiempo se protege a este animal para que no desaparezca." },
  { tema: "vida diaria", texto: "Cada mañana, el panadero del barrio enciende su horno antes de que salga el sol. Cuando abre la puerta, el aroma del pan caliente llena toda la calle." },
  { tema: "lectura", texto: "Leer un libro es como viajar sin moverse de la silla. En cada página podemos conocer lugares lejanos, personas valientes y mundos que solo existen en la imaginación." },
  { tema: "ciencia", texto: "El corazón humano late unas cien mil veces al día. Es un músculo fuerte que nunca descansa, y para cuidarlo debemos comer sano, dormir bien y hacer ejercicio." },
  { tema: "naturaleza", texto: "La Amazonía peruana es un bosque enorme lleno de vida. Allí habitan monos, guacamayos, delfines rosados y miles de plantas que todavía estamos aprendiendo a conocer." },
  { tema: "fábula", texto: "Una pequeña hormiga encontró una semilla y la llevó hasta su casa. Aunque era más grande que ella, no se rindió, porque sabía que el esfuerzo diario trae buenos frutos." },
  { tema: "ciencia", texto: "La Luna no tiene luz propia. Lo que vemos brillar en la noche es la luz del Sol que se refleja en su superficie, llena de cráteres y montañas." },
  { tema: "valores", texto: "En el colegio aprendemos a trabajar en equipo. Cuando cada uno aporta una idea, el resultado final es mejor que el que lograríamos solos." },
  { tema: "valores", texto: "El agua es un recurso valioso que no debemos desperdiciar. Cerrar el caño mientras nos cepillamos los dientes es un pequeño gesto que ayuda mucho." },
  { tema: "perú", texto: "Machu Picchu fue construida hace más de quinientos años en lo alto de una montaña. Sus muros de piedra encajan tan bien que no necesitan ningún tipo de mezcla." },
  { tema: "vida diaria", texto: "Mi abuela guarda sus recetas en un cuaderno viejo. Cada página tiene manchas de harina y de chocolate, y cuenta la historia de una comida especial en familia." },
  { tema: "naturaleza", texto: "Las abejas visitan cientos de flores en un solo día. Gracias a ellas, muchas plantas pueden dar frutos, y nosotros podemos disfrutar de manzanas, fresas y paltas." },
  { tema: "arte", texto: "Practicar un instrumento musical requiere paciencia. Al principio los sonidos parecen desordenados, pero con el tiempo los dedos encuentran el camino correcto." },
  { tema: "cuento", texto: "El niño miró por la ventana y vio que la lluvia había terminado. Salió corriendo al jardín, saltó en los charcos y descubrió un arcoíris sobre los cerros." },
  { tema: "naturaleza", texto: "La tortuga marina recorre miles de kilómetros en el océano. Cuando llega el momento, vuelve a la misma playa donde nació para dejar sus huevos en la arena." },
  { tema: "valores", texto: "Un buen amigo escucha con atención, comparte lo que tiene y te acompaña tanto en los días felices como en los días difíciles." },
  { tema: "perú", texto: "En la costa del Perú casi nunca llueve, pero en invierno aparece una neblina húmeda que cubre la ciudad. Los limeños la llaman garúa cuando cae como una lluvia muy fina." },

  // ───────────── Signos ¿? ¡! y punto y coma ─────────────
  { tema: "perú", texto: "¿Sabías que el Perú tiene una enorme variedad de climas? En un solo día puedes pasar del calor del desierto al frío de la puna; por eso se dice que es un país de contrastes." },
  { tema: "cuento", texto: "¡Qué gran sorpresa se llevó Lucía! Al abrir la caja encontró un pequeño telescopio. Esa misma noche, desde la azotea de su casa, observó por primera vez los anillos de Saturno." },
  { tema: "naturaleza", texto: "El río Amazonas nace en los Andes del Perú y desemboca en el océano Atlántico. ¿Te imaginas el largo viaje que hace una gota de agua desde la montaña hasta el mar?" },
  { tema: "historia", texto: "Los incas no conocían la escritura como la entendemos hoy; sin embargo, usaban los quipus, cordones con nudos que servían para llevar cuentas y guardar información." },
  { tema: "ciencia", texto: "¿Por qué el cielo es azul? La luz del Sol está formada por muchos colores; al atravesar el aire, el color azul se dispersa más que los otros y llena todo el cielo." },
  { tema: "valores", texto: "¡No te rindas! Cada error es una oportunidad para aprender algo nuevo. Los grandes inventores fallaron muchas veces antes de lograr lo que buscaban." },
  { tema: "literatura", texto: "Ricardo Palma escribió las Tradiciones peruanas, un conjunto de relatos llenos de humor e historia. Gracias a él, muchas leyendas de Lima llegaron hasta nuestros días." },
  { tema: "naturaleza", texto: "El pingüino de Humboldt vive en las costas del Perú y de Chile. Aunque no puede volar, es un nadador excelente; bajo el agua parece que vuela entre las olas." },
  { tema: "imaginación", texto: "¿Qué harías si pudieras viajar en el tiempo? Algunos visitarían a los dinosaurios; otros preferirían conocer el futuro y descubrir cómo serán las ciudades." },
  { tema: "perú", texto: "Arequipa es conocida como la Ciudad Blanca. Muchas de sus casonas e iglesias fueron construidas con sillar, una piedra volcánica de color claro que brilla con el sol." },
  { tema: "colegio", texto: "¡Atención, equipo! Mañana es la feria de ciencias. Revisen sus maquetas, preparen sus carteles y practiquen la explicación; el jurado hará muchas preguntas." },
  { tema: "ciencia", texto: "La Tierra gira sobre sí misma y, al mismo tiempo, da vueltas alrededor del Sol. El primer movimiento produce el día y la noche; el segundo, junto con la inclinación del planeta, las estaciones." },
  { tema: "literatura", texto: "César Vallejo nació en Santiago de Chuco, en La Libertad. Es considerado uno de los poetas más importantes de la lengua española, y sus versos se leen en todo el mundo." },
  { tema: "perú", texto: "¿Cuál es tu comida favorita? Para muchos peruanos, el ceviche ocupa el primer lugar; para otros, nada supera un buen ají de gallina o un lomo saltado." },
  { tema: "naturaleza", texto: "Durante la noche, el desierto de Ica se vuelve silencioso y frío. ¡Cuántas estrellas se pueden ver lejos de las luces de la ciudad!" },
  { tema: "cuento", texto: "Mi hermano menor siempre pregunta lo mismo: ¿por qué? ¿Por qué llueve? ¿Por qué los gatos ronronean? Mamá dice que esa curiosidad lo convertirá en científico." },

  // ───────────── Números, comillas, paréntesis y guiones ─────────────
  { tema: "perú", texto: "El nevado Huascarán (Áncash) es la montaña más alta del Perú: alcanza unos 6768 metros sobre el nivel del mar y forma parte de la Cordillera Blanca." },
  { tema: "historia", texto: "El 28 de julio de 1821, José de San Martín proclamó la independencia del Perú en Lima. Por eso, cada año celebramos las Fiestas Patrias con desfiles, música y comida típica." },
  { tema: "lectura", texto: "Según la profesora, \"leer 20 minutos al día\" puede cambiar tu vida: en un año sumarías más de 7000 minutos de lectura (¡casi 122 horas!)." },
  { tema: "vida diaria", texto: "La receta de la abuela dice: 2 tazas de harina, 3 huevos, 1 taza de azúcar y 250 gramos de mantequilla. El horno debe estar a 180 grados durante 35 minutos." },
  { tema: "ciencia", texto: "El sistema solar tiene 8 planetas: Mercurio, Venus, la Tierra, Marte, Júpiter, Saturno, Urano y Neptuno. Plutón fue considerado el noveno planeta hasta el año 2006." },
  { tema: "lenguaje", texto: "La palabra \"chacra\" viene del quechua y significa terreno de cultivo. Otras palabras de origen quechua que usamos a diario son \"cancha\", \"choclo\" y \"palta\"." },
  { tema: "colegio", texto: "El partido de vóley terminó 3-2. Al final, la capitana dijo: \"Ganamos porque nunca dejamos de animarnos\" (y todo el coliseo aplaudió de pie)." },
  { tema: "perú", texto: "Las líneas de Nasca (en Ica) fueron trazadas hace unos 2000 años. Algunas figuras, como el colibrí o el mono, miden más de 90 metros y solo se aprecian bien desde el aire." },
  { tema: "matemática", texto: "Un año tiene 365 días, 52 semanas y 12 meses. Cada 4 años hay un año bisiesto (de 366 días), en el que febrero tiene 29 días en lugar de 28." },
  { tema: "colegio", texto: "El horario de mañana es: Matemática (8:00 - 9:30), Comunicación (9:45 - 11:15) y Educación Física (11:30 - 13:00). ¡No olvides tu buzo!" },
  { tema: "lenguaje", texto: "Se escribe \"por qué\" separado y con tilde cuando preguntamos, y \"porque\" junto cuando respondemos. Por ejemplo: -¿Por qué llegaste tarde? -Porque perdí el bus." },
  { tema: "naturaleza", texto: "Muchos colibríes baten sus alas entre 50 y 80 veces por segundo (¡más rápido de lo que podemos ver!). Además, pueden quedarse quietos en el aire e incluso volar hacia atrás." },

  // ───────────── Símbolos $ % @ & / # = y montos en soles ─────────────
  { tema: "matemática", texto: "En la tienda escolar, un cuaderno cuesta S/ 4.50 y un lapicero S/ 1.20. Si compras 3 cuadernos y 2 lapiceros, pagarás S/ 15.90 en total." },
  { tema: "colegio", texto: "La encuesta del aula mostró que el 45% prefiere el fútbol, el 30% el vóley y el 25% restante otros deportes como natación o atletismo." },
  { tema: "colegio", texto: "Para inscribirte en el taller, escribe a talleres@ejemplo.edu.pe con el asunto \"Inscripción #2026\" e indica tu nombre, grado y sección." },
  { tema: "matemática", texto: "El lunes el dólar estaba a S/ 3.75 y el viernes subió a S/ 3.80. ¿Cuántos soles más cuesta comprar $ 20 el viernes que el lunes?" },
  { tema: "matemática", texto: "La librería \"Pérez & Hijos\" ofrece un 20% de descuento en útiles escolares: una mochila de S/ 80.00 queda en S/ 64.00." },
  { tema: "colegio", texto: "En las redes del colegio usamos el hashtag #LeerEsCrecer. Este mes se publicaron 120 fotos y el 75% fueron de la feria del libro." },
  { tema: "matemática", texto: "La fracción 3/4 equivale al 75% y la fracción 1/2 equivale al 50%. Si un pastel se divide en 8 partes y comes 2, ¿qué porcentaje del pastel comiste?" },
  { tema: "matemática", texto: "El pasaje de bus cuesta S/ 2.50; con el carné escolar pagas el 50%, es decir, S/ 1.25. En 20 días de clase (ida y vuelta) ahorrarías S/ 50.00." },
  { tema: "tecnología", texto: "Una contraseña segura combina mayúsculas, minúsculas, números y símbolos como @, #, $ o &. Nunca compartas tu clave con nadie (¡ni siquiera con tu mejor amigo!)." },
  { tema: "matemática", texto: "Informe de la kermés: ventas = S/ 1250.00; gastos = S/ 430.00; ganancia = S/ 820.00, es decir, el 65.6% de lo vendido." },
  { tema: "ciencia", texto: "Inventario del laboratorio: 24 microscopios, 12 balanzas y 36 tubos de ensayo. El 25% de los tubos necesita reemplazo, o sea, 9 tubos en total." },
];
