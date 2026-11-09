// Banco de textos inicial de TypeLake.
// Más adelante este banco se guardará en la base de datos y el administrador
// podrá editarlo desde el panel. Por ahora vive aquí.
//
// Niveles:
//   1 - minúsculas, tildes y ñ, con comas y puntos
//   2 - mayúsculas, ¿? ¡! y punto y coma
//   3 - números, comillas, paréntesis y guiones
//   4 - símbolos: $ % @ & / # = y montos en soles
//
// Reglas: solo caracteres que se escriben con teclado latinoamericano,
// comillas rectas ("), guion simple (-), sin espacios dobles.

export type Nivel = 1 | 2 | 3 | 4;

export interface Fragmento {
  nivel: Nivel;
  tema: string;
  texto: string;
}

export const NIVELES: Record<Nivel, { nombre: string; descripcion: string }> = {
  1: { nombre: "Nivel 1", descripcion: "Minúsculas, tildes y ñ" },
  2: { nombre: "Nivel 2", descripcion: "Mayúsculas y signos ¿? ¡!" },
  3: { nombre: "Nivel 3", descripcion: "Números, comillas y paréntesis" },
  4: { nombre: "Nivel 4", descripcion: "Símbolos: $ % @ & / #" },
};

export const FRAGMENTOS: Fragmento[] = [
  // ───────────── NIVEL 1 ─────────────
  { nivel: 1, tema: "naturaleza", texto: "el cóndor andino es una de las aves voladoras más grandes del mundo. puede planear durante horas sin mover sus alas, aprovechando las corrientes de aire caliente que suben desde los valles." },
  { nivel: 1, tema: "perú", texto: "en la sierra del perú se cultivan miles de variedades de papa. los antiguos pobladores aprendieron a secarlas con el frío de la noche y el sol del día, y así crearon el chuño." },
  { nivel: 1, tema: "perú", texto: "el lago titicaca está entre perú y bolivia. es uno de los lagos navegables más altos del planeta, y en sus aguas viven familias que construyen islas flotantes con totora." },
  { nivel: 1, tema: "naturaleza", texto: "la vicuña vive en las alturas de los andes. su lana es muy fina y abrigadora, por eso desde hace mucho tiempo se protege a este animal para que no desaparezca." },
  { nivel: 1, tema: "vida diaria", texto: "cada mañana, el panadero del barrio enciende su horno antes de que salga el sol. cuando abre la puerta, el aroma del pan caliente llena toda la calle." },
  { nivel: 1, tema: "lectura", texto: "leer un libro es como viajar sin moverse de la silla. en cada página podemos conocer lugares lejanos, personas valientes y mundos que solo existen en la imaginación." },
  { nivel: 1, tema: "ciencia", texto: "el corazón humano late unas cien mil veces al día. es un músculo fuerte que nunca descansa, y para cuidarlo debemos comer sano, dormir bien y hacer ejercicio." },
  { nivel: 1, tema: "naturaleza", texto: "la amazonía peruana es un bosque enorme lleno de vida. allí habitan monos, guacamayos, delfines rosados y miles de plantas que todavía estamos aprendiendo a conocer." },
  { nivel: 1, tema: "fábula", texto: "una pequeña hormiga encontró una semilla y la llevó hasta su casa. aunque era más grande que ella, no se rindió, porque sabía que el esfuerzo diario trae buenos frutos." },
  { nivel: 1, tema: "ciencia", texto: "la luna no tiene luz propia. lo que vemos brillar en la noche es la luz del sol que se refleja en su superficie, llena de cráteres y montañas." },
  { nivel: 1, tema: "valores", texto: "en el colegio aprendemos a trabajar en equipo. cuando cada uno aporta una idea, el resultado final es mejor que el que lograríamos solos." },
  { nivel: 1, tema: "valores", texto: "el agua es un recurso valioso que no debemos desperdiciar. cerrar el caño mientras nos cepillamos los dientes es un pequeño gesto que ayuda mucho." },
  { nivel: 1, tema: "perú", texto: "machu picchu fue construida hace más de quinientos años en lo alto de una montaña. sus muros de piedra encajan tan bien que no necesitan ningún tipo de mezcla." },
  { nivel: 1, tema: "vida diaria", texto: "mi abuela guarda sus recetas en un cuaderno viejo. cada página tiene manchas de harina y de chocolate, y cuenta la historia de una comida especial en familia." },
  { nivel: 1, tema: "naturaleza", texto: "las abejas visitan cientos de flores en un solo día. gracias a ellas, muchas plantas pueden dar frutos, y nosotros podemos disfrutar de manzanas, fresas y paltas." },
  { nivel: 1, tema: "arte", texto: "practicar un instrumento musical requiere paciencia. al principio los sonidos parecen desordenados, pero con el tiempo los dedos encuentran el camino correcto." },
  { nivel: 1, tema: "cuento", texto: "el niño miró por la ventana y vio que la lluvia había terminado. salió corriendo al jardín, saltó en los charcos y descubrió un arcoíris sobre los cerros." },
  { nivel: 1, tema: "naturaleza", texto: "la tortuga marina recorre miles de kilómetros en el océano. cuando llega el momento, vuelve a la misma playa donde nació para dejar sus huevos en la arena." },
  { nivel: 1, tema: "valores", texto: "un buen amigo escucha con atención, comparte lo que tiene y te acompaña tanto en los días felices como en los días difíciles." },
  { nivel: 1, tema: "perú", texto: "en la costa del perú casi nunca llueve, pero en invierno aparece una neblina húmeda que cubre la ciudad. los limeños la llaman garúa cuando cae como una lluvia muy fina." },

  // ───────────── NIVEL 2 ─────────────
  { nivel: 2, tema: "perú", texto: "¿Sabías que el Perú tiene una enorme variedad de climas? En un solo día puedes pasar del calor del desierto al frío de la puna; por eso se dice que es un país de contrastes." },
  { nivel: 2, tema: "cuento", texto: "¡Qué gran sorpresa se llevó Lucía! Al abrir la caja encontró un pequeño telescopio. Esa misma noche, desde la azotea de su casa, observó por primera vez los anillos de Saturno." },
  { nivel: 2, tema: "naturaleza", texto: "El río Amazonas nace en los Andes del Perú y desemboca en el océano Atlántico. ¿Te imaginas el largo viaje que hace una gota de agua desde la montaña hasta el mar?" },
  { nivel: 2, tema: "historia", texto: "Los incas no conocían la escritura como la entendemos hoy; sin embargo, usaban los quipus, cordones con nudos que servían para llevar cuentas y guardar información." },
  { nivel: 2, tema: "ciencia", texto: "¿Por qué el cielo es azul? La luz del Sol está formada por muchos colores; al atravesar el aire, el color azul se dispersa más que los otros y llena todo el cielo." },
  { nivel: 2, tema: "valores", texto: "¡No te rindas! Cada error es una oportunidad para aprender algo nuevo. Los grandes inventores fallaron muchas veces antes de lograr lo que buscaban." },
  { nivel: 2, tema: "literatura", texto: "Ricardo Palma escribió las Tradiciones peruanas, un conjunto de relatos llenos de humor e historia. Gracias a él, muchas leyendas de Lima llegaron hasta nuestros días." },
  { nivel: 2, tema: "naturaleza", texto: "El pingüino de Humboldt vive en las costas del Perú y de Chile. Aunque no puede volar, es un nadador excelente; bajo el agua parece que vuela entre las olas." },
  { nivel: 2, tema: "imaginación", texto: "¿Qué harías si pudieras viajar en el tiempo? Algunos visitarían a los dinosaurios; otros preferirían conocer el futuro y descubrir cómo serán las ciudades." },
  { nivel: 2, tema: "perú", texto: "Arequipa es conocida como la Ciudad Blanca. Muchas de sus casonas e iglesias fueron construidas con sillar, una piedra volcánica de color claro que brilla con el sol." },
  { nivel: 2, tema: "colegio", texto: "¡Atención, equipo! Mañana es la feria de ciencias. Revisen sus maquetas, preparen sus carteles y practiquen la explicación; el jurado hará muchas preguntas." },
  { nivel: 2, tema: "ciencia", texto: "La Tierra gira sobre sí misma y, al mismo tiempo, da vueltas alrededor del Sol. El primer movimiento produce el día y la noche; el segundo, junto con la inclinación del planeta, las estaciones." },
  { nivel: 2, tema: "literatura", texto: "César Vallejo nació en Santiago de Chuco, en La Libertad. Es considerado uno de los poetas más importantes de la lengua española, y sus versos se leen en todo el mundo." },
  { nivel: 2, tema: "perú", texto: "¿Cuál es tu comida favorita? Para muchos peruanos, el ceviche ocupa el primer lugar; para otros, nada supera un buen ají de gallina o un lomo saltado." },
  { nivel: 2, tema: "naturaleza", texto: "Durante la noche, el desierto de Ica se vuelve silencioso y frío. ¡Cuántas estrellas se pueden ver lejos de las luces de la ciudad!" },
  { nivel: 2, tema: "cuento", texto: "Mi hermano menor siempre pregunta lo mismo: ¿por qué? ¿Por qué llueve? ¿Por qué los gatos ronronean? Mamá dice que esa curiosidad lo convertirá en científico." },

  // ───────────── NIVEL 3 ─────────────
  { nivel: 3, tema: "perú", texto: "El nevado Huascarán (Áncash) es la montaña más alta del Perú: alcanza unos 6768 metros sobre el nivel del mar y forma parte de la Cordillera Blanca." },
  { nivel: 3, tema: "historia", texto: "El 28 de julio de 1821, José de San Martín proclamó la independencia del Perú en Lima. Por eso, cada año celebramos las Fiestas Patrias con desfiles, música y comida típica." },
  { nivel: 3, tema: "lectura", texto: "Según la profesora, \"leer 20 minutos al día\" puede cambiar tu vida: en un año sumarías más de 7000 minutos de lectura (¡casi 122 horas!)." },
  { nivel: 3, tema: "vida diaria", texto: "La receta de la abuela dice: 2 tazas de harina, 3 huevos, 1 taza de azúcar y 250 gramos de mantequilla. El horno debe estar a 180 grados durante 35 minutos." },
  { nivel: 3, tema: "ciencia", texto: "El sistema solar tiene 8 planetas: Mercurio, Venus, la Tierra, Marte, Júpiter, Saturno, Urano y Neptuno. Plutón fue considerado el noveno planeta hasta el año 2006." },
  { nivel: 3, tema: "lenguaje", texto: "La palabra \"chacra\" viene del quechua y significa terreno de cultivo. Otras palabras de origen quechua que usamos a diario son \"cancha\", \"choclo\" y \"palta\"." },
  { nivel: 3, tema: "colegio", texto: "El partido de vóley terminó 3-2. Al final, la capitana dijo: \"Ganamos porque nunca dejamos de animarnos\" (y todo el coliseo aplaudió de pie)." },
  { nivel: 3, tema: "perú", texto: "Las líneas de Nasca (en Ica) fueron trazadas hace unos 2000 años. Algunas figuras, como el colibrí o el mono, miden más de 90 metros y solo se aprecian bien desde el aire." },
  { nivel: 3, tema: "matemática", texto: "Un año tiene 365 días, 52 semanas y 12 meses. Cada 4 años hay un año bisiesto (de 366 días), en el que febrero tiene 29 días en lugar de 28." },
  { nivel: 3, tema: "colegio", texto: "El horario de mañana es: Matemática (8:00 - 9:30), Comunicación (9:45 - 11:15) y Educación Física (11:30 - 13:00). ¡No olvides tu buzo!" },
  { nivel: 3, tema: "lenguaje", texto: "Se escribe \"por qué\" separado y con tilde cuando preguntamos, y \"porque\" junto cuando respondemos. Por ejemplo: -¿Por qué llegaste tarde? -Porque perdí el bus." },
  { nivel: 3, tema: "naturaleza", texto: "Muchos colibríes baten sus alas entre 50 y 80 veces por segundo (¡más rápido de lo que podemos ver!). Además, pueden quedarse quietos en el aire e incluso volar hacia atrás." },

  // ───────────── NIVEL 4 ─────────────
  { nivel: 4, tema: "matemática", texto: "En la tienda escolar, un cuaderno cuesta S/ 4.50 y un lapicero S/ 1.20. Si compras 3 cuadernos y 2 lapiceros, pagarás S/ 15.90 en total." },
  { nivel: 4, tema: "colegio", texto: "La encuesta del aula mostró que el 45% prefiere el fútbol, el 30% el vóley y el 25% restante otros deportes como natación o atletismo." },
  { nivel: 4, tema: "colegio", texto: "Para inscribirte en el taller, escribe a talleres@ejemplo.edu.pe con el asunto \"Inscripción #2026\" e indica tu nombre, grado y sección." },
  { nivel: 4, tema: "matemática", texto: "El lunes el dólar estaba a S/ 3.75 y el viernes subió a S/ 3.80. ¿Cuántos soles más cuesta comprar $ 20 el viernes que el lunes?" },
  { nivel: 4, tema: "matemática", texto: "La librería \"Pérez & Hijos\" ofrece un 20% de descuento en útiles escolares: una mochila de S/ 80.00 queda en S/ 64.00." },
  { nivel: 4, tema: "colegio", texto: "En las redes del colegio usamos el hashtag #LeerEsCrecer. Este mes se publicaron 120 fotos y el 75% fueron de la feria del libro." },
  { nivel: 4, tema: "matemática", texto: "La fracción 3/4 equivale al 75% y la fracción 1/2 equivale al 50%. Si un pastel se divide en 8 partes y comes 2, ¿qué porcentaje del pastel comiste?" },
  { nivel: 4, tema: "matemática", texto: "El pasaje de bus cuesta S/ 2.50; con el carné escolar pagas el 50%, es decir, S/ 1.25. En 20 días de clase (ida y vuelta) ahorrarías S/ 50.00." },
  { nivel: 4, tema: "tecnología", texto: "Una contraseña segura combina mayúsculas, minúsculas, números y símbolos como @, #, $ o &. Nunca compartas tu clave con nadie (¡ni siquiera con tu mejor amigo!)." },
  { nivel: 4, tema: "matemática", texto: "Informe de la kermés: ventas = S/ 1250.00; gastos = S/ 430.00; ganancia = S/ 820.00, es decir, el 65.6% de lo vendido." },
  { nivel: 4, tema: "ciencia", texto: "Inventario del laboratorio: 24 microscopios, 12 balanzas y 36 tubos de ensayo. El 25% de los tubos necesita reemplazo, o sea, 9 tubos en total." },
];
