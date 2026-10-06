/* =====================================================================
   AYUDA · botón "?" de la barra de guardia
   Muestra en pocas líneas qué se hace en la pantalla actual.
   Para cambiar un texto, editá la lista de abajo.
   ===================================================================== */
const AYUDA = {
  pin: ['Ingresá tu PIN', [
    'Escribí tus 4 números. En la PC también podés usar el teclado.',
    'Si te olvidaste el PIN o quedaste bloqueado (5 intentos fallidos bloquean 10 minutos), pedile a un administrador que lo resetee desde Panel → Personal.']],
  newpin: ['Elegir PIN nuevo', [
    'Elegí 4 números que no sean todos iguales ni seguidos (como 1111 o 1234) y repetilos para confirmar.',
    'Es el mismo PIN para todas las secciones de la app.']],
  kioscoWho: ['Asistencia general', [
    'Tocá tu nombre al llegar al cuartel y otra vez al irte. Podés buscar por apellido.',
    'Quien aparece con "● Adentro" ya fichó la entrada.',
    'La guardia, la capacitación y el mantenimiento de guardia se cargan desde la app de Guardia en el celular, no acá.']],
  kioscoMe: ['Asistencia general', [
    '<b>Registrar entrada:</b> elegí el motivo y tocá Fichar entrada. Al irte, entrá de nuevo y tocá Registrar salida.',
    '<b>Cargar horas pasadas:</b> si te olvidaste de fichar, cargá la entrada y la salida. Queda marcada para que un encargado la revise.',
    '<b>Curso o actividad fuera del cuartel:</b> cuando volvés, cargá las fechas y el horario de cada día. Se crea un registro por día, para revisar. No fiches entrada al irte de viaje: si una entrada queda abierta más de 14 h, se cierra sola y queda para revisar.',
    'Al terminar tocá Terminar. Si no, la sesión se cierra sola al rato.']],
  sirena: ['Sirena', [
    'Solo administradores, jefatura y superiores.',
    'Elegí la cantidad de toques o Continua, confirmá, y para cortar tocá Detener.']],
  guardiaWho: ['App de guardia', [
    'Elegí tu nombre e ingresá tu PIN. En tu celular queda recordado y la próxima vez va directo al PIN.',
    'Después de entrar tocá <b>Activar avisos</b> para recibir el recordatorio de las 19:00, las alertas y las novedades.']],
  guardiaMe: ['Tu guardia', [
    'Registrá la guardia de esta noche <b>antes de las 20:00</b>. Después queda como fuera de hora.',
    'Si no podés ir, elegí un reemplazo de la otra guardia. Le llega un aviso y la noche le cuenta como guardia. Si cambiás la respuesta, también se le avisa.',
    '<b>Capacitación</b> y <b>Mantenimiento</b>: cargá la hora de inicio, la de fin y qué se hizo.',
    'Tu semana: verde completa, amarillo parcial, rojo no va, negro sin registro.']],
  guardiaForm: ['Registrar la guardia', [
    '<b>Completa:</b> vas toda la noche (20 a 07 h).',
    '<b>Parcial:</b> vas unas horas. Elegí quién cubre el resto y anotá el horario.',
    '<b>No puedo ir:</b> el reemplazo es obligatorio y tiene que ser de la otra guardia.']],
  guardiaAct: ['Capacitación y mantenimiento', [
    'Indicá la fecha, la hora de inicio y fin, y la temática o las tareas. Se suma a tus horas de guardia del mes.']],
  alertasOut: ['Alertas', [
    'Acá aparecen las alertas activas. Ingresá con tu PIN para ponerte en apresto.',
    'Más abajo podés elegir y probar el sonido de las alertas en este dispositivo.']],
  alertasIn: ['Alertas', [
    '<b>Alerta amarilla:</b> si estás disponible tocá Me pongo en apresto. Podés dejar una nota, por ejemplo "llego en 20 min". Si cambia tu situación, tocá Salir del apresto.',
    '<b>Alerta roja:</b> la jefatura o un superior elige quiénes van entre los que están en apresto. Si te designan, te llega un aviso y acá ves el lugar de encuentro y la hora de salida.',
    '<b>Silenciar</b> corta el sonido de la alerta en este dispositivo.']],
  alertasPuede: 'Jefatura y superiores emiten la alerta con Emitir alerta amarilla, y la finalizan o cancelan cuando termina.',
  alertasRoja: 'Pasar a alerta roja (jefatura y superiores): marcá quiénes van y completá encuentro, salida y unidades. En Configuración (jefatura y administradores) se editan los tipos de alerta y los tonos para todos.',
  sciHid: ['Hidráulica', [
    'Elegí la salida, la presión en punta, el caudal, la manguera, los tramos y el desnivel. Se calcula la presión de trabajo en la bomba y la autonomía del tanque.',
    'Son cálculos de referencia: el manómetro y las indicaciones del fabricante tienen prioridad.']],
  sciDotOut: ['Dotaciones', ['Ingresá con tu PIN para ver los siniestros, tu unidad y tu función.']],
  sciDot: ['Dotaciones', ['Siniestros en curso y cerrados. Tocá uno para ver las unidades y en cuál estás.']],
  sciDotPuede: 'Jefatura y superiores abren uno nuevo con Nuevo siniestro.',
  sciSin: ['Siniestro', ['Acá ves en qué unidad y con qué función estás. La pantalla se actualiza sola cada minuto.']],
  sciSinPuede: ['Siniestro', [
    'Agregá las unidades, elegí quién está a cargo y asigná a cada bombero a una unidad con su función.',
    '<b>Avisar a la dotación</b> manda la asignación al celular de cada uno.',
    'Anotá en la <b>Bitácora</b> lo importante. Con <b>Completar partes</b> armás el parte de prensa y el de intervención.']],
  sciParte: ['Partes', [
    'Completá los horarios y los datos y tocá <b>Guardar datos del parte</b>.',
    'El parte de prensa se arma solo: revisalo, retocalo si hace falta y tocá Copiar o Compartir. No pongas ahí nombres de víctimas, direcciones exactas ni patentes.',
    'El parte de intervención es el PDF completo. Antes de descargarlo podés adjuntar hasta 6 croquis o fotos.']],
  sciCfg: ['Configuración SCI', [
    'Cargá las unidades con su tipo (sale en el parte de prensa), los litros del tanque y los límites de la bomba.',
    'También las mangueras con su coeficiente, las funciones de la dotación y la identificación del cuartel para los partes.']],
  eppWho: ['EPP', ['Ingresá con tu PIN para pedir equipos y ver tu equipamiento.']],
  eppMis: ['Mis pedidos', [
    'Elegí el equipo, el talle, la cantidad y el motivo, y tocá Enviar pedido. Te avisamos cuando lo aprueben o lo rechacen.',
    'Mientras está pendiente lo podés cancelar.']],
  eppEq: ['Mi equipamiento', [
    'Tu equipamiento con la fecha de fabricación y el vencimiento: rojo vencido, naranja vence en menos de un año, verde vigente.',
    'Si algo no coincide con lo que tenés, avisale a tu superior.']],
  eppApr: ['Aprobar pedidos', [
    'Aprobá o rechazá cada pedido. Para rechazar hay que poner el motivo, y nadie puede aprobar su propio pedido.',
    'Cuando entregues un equipo aprobado, tocá <b>Registrar entrega</b> y cargá la fecha de fabricación de la etiqueta. El equipo pasa a su equipamiento y el anterior queda de baja.']],
  eppInv: ['Equipamiento', [
    'Cada celda muestra la fecha de fabricación y el talle: rojo vencido, naranja vence en menos de un año, verde vigente, gris sin fecha, "—" no tiene.',
    'Tocá a una persona para corregir, agregar o dar de baja equipos.']],
  eppPer: ['Equipamiento de la persona', [
    '<b>Agregar equipo</b> carga uno nuevo. <b>Corregir</b> arregla el talle o la fecha.',
    '<b>Dar de baja</b> cuando se retira (vencido, roto, devuelto). Queda en el historial.']],
  eppHis: ['Historial', ['Todos los pedidos con su estado. Filtrá por bombero, estado o equipo, y tocá Historial del pedido para ver quién lo aprobó y lo entregó.']],
  eppCat: ['Catálogo', ['Equipos que se pueden pedir, con los talles separados por coma y la vida útil en años (vacía si no vence).']],
  novOut: ['Novedades', ['Cursos, charlas, eventos y avisos. Para anotarte en uno que pide confirmación, tocá Ingresar con mi PIN.']],
  novIn: ['Novedades', [
    'Si la novedad pide confirmación, tocá <b>Asisto</b>. Si se llenaron los cupos quedás como suplente, y te avisamos si se libera un lugar.',
    'Si no podés ir, tocá <b>Ya no asisto</b> para dejarle el lugar a otro.']],
  novRol: 'Para publicar tocá Publicar novedad: se avisa a todos los celulares. Tildá Pedir confirmación si querés que se anoten, con cupos y suplentes si hace falta.',
  panelWho: ['Panel', ['Para administradores, jefatura y superiores. Cada uno entra con su propio PIN.']],
  panelGuardia: ['Panel · Guardia', [
    'Quién confirmó esta noche y el resumen del mes por bombero. Tocá a una persona para ver su ficha anual.',
    '<b>Por semana</b> muestra la planilla de cada semana de guardia (miércoles a miércoles) para descargar en PDF y firmar.']],
  panelAsist: ['Panel · Asistencia general', [
    'Horas por actividad y por bombero. Aprobá o borrá las cargas manuales que esperan revisión.',
    '<b>Editar actividades</b> agrega, renombra, ordena o desactiva las actividades que aparecen al fichar.']],
  panelInf: ['Panel · Resúmenes', ['Elegí un bombero (o Todos) y el período. Descargá el PDF oficial para la firma del Jefe y el Sub Jefe, o el Excel con el detalle.']],
  calMi: ['Mi calificación', [
    'Tu porcentaje de asistencia del semestre, calculado con guardias, capacitación y mantenimiento de guardia, asistencia general, convocatorias de novedades y alertas.',
    'El porcentaje da los puntos de asistencia según el Decreto 957/04 (100 % = 5 puntos). El recuadro amarillo te dice qué parte te baja más.',
    'Vocación, capacidad y cualidades personales las califica la junta a fin de año.']],
  panelCalif: ['Panel · Calificación', [
    '<b>Semestres:</b> control de mitad de año, solo la asistencia, con cada parte por separado.',
    '<b>Año completo:</b> la junta marca de 0 a 5 vocación, capacidad y cualidades. La asistencia la calcula la app; tocá el nombre para ver el detalle, corregirla con motivo o calificar a los oficiales.',
    '<b>Metas y pesos:</b> horas pedidas por semestre y cuánto pesa cada parte. <b>Cerrar calificación</b> guarda todo, marca observados y publica la mención.']],
  tarMis: ['Mis tareas', [
    '<b>Empezar</b> marca que la estás haciendo; <b>Terminar</b> (o <b>Ya la hice</b>) la manda a revisión, con foto y nota si querés.',
    'La revisa un superior de tu guardia. Si te la devuelven, aparece con el comentario de qué falta.',
    '<b>Podés pedir</b>: tareas vencidas que podés anotarte por tu cuenta. Suman en tu calificación como iniciativa.',
    'Las horas se siguen cargando en Mantenimiento/limpieza: al terminar te ofrece cargarlas con la descripción completa.']],
  tarPanel: ['Panel · Tareas', [
    '<b>Tablero</b>: por hacer, en curso, para revisar y hechas. Las que asignaste vos las revisa otro superior de la guardia.',
    '<b>Asignar</b>: lugar, tareas y personas en un solo formulario. Los superiores asignan a su guardia; jefatura y administradores, a cualquiera.',
    '<b>Periódicas</b>: semáforo de las tareas con frecuencia. Tocá una casilla para asignarla.',
    '<b>Catálogo</b>: agregá unidades, sectores y tareas, y la frecuencia (cada cuántos días) si hace falta que la app avise.']],
  legLista: ['Panel · Legajos', [
    'Tocá a una persona para ver su legajo: jerarquía, nivel, antigüedad (una estrella cada 5 años), departamentos, cursos e historial.',
    'Cargan y corrigen: administradores, jefatura y superiores. Los ascensos y cambios de nivel quedan solos en el historial.',
    '<b>Niveles y departamentos</b> (jefatura y administradores): agregar, renombrar, ordenar o quitar, y subir la insignia de cada departamento.',
    '<b>Formulario de consentimiento</b>: el PDF para imprimir y firmar antes de cargar datos personales o médicos.']],
  legPers: ['Legajo', [
    '<b>Institucional</b>: datos de ingreso, nivel, departamentos, cursos y certificados con su vencimiento, calificaciones y ascensos. <b>Foja de servicios</b> descarga el PDF para firmar.',
    '<b>Personal y médico</b> (solo la persona, el Jefe, el Sub Jefe y los administradores): se carga después de registrar el consentimiento firmado. Cada consulta queda en el historial de accesos.',
    'Si retira el consentimiento, se borran sus datos personales, médicos y la foto. Tres años después de una baja, el legajo completo se borra solo.']],
  legMi: ['Mi legajo', [
    'Tu jerarquía, nivel, antigüedad, departamentos, cursos e historial. Lo cargan la jefatura y los superiores; si algo está mal, avisales.',
    '<b>Personal y médico</b>: tus datos los ven solo vos, el Jefe, el Sub Jefe y los administradores del sistema. Abajo ves quién los consultó y cuándo.']],
  panelPers: ['Panel · Personal', [
    'Altas, bajas, cambios de guardia, jefatura, permisos y <b>jerarquía</b> (con <b>Editar</b>). <b>Resetear PIN</b> si alguien se lo olvidó.',
    'Abajo están la configuración de horarios, la hoja membretada y la habilitación de la PC del cuartel.']]
};

function ayudaActual(){
  const s = sess() || {}, A = AYUDA;
  if(s.step === 'pin') return A.pin;
  if(s.step === 'newpin') return A.newpin;
  const v = s.step === 'me' ? s.who : null, rol = v ? roleOf(v) : null;
  const mas = (base, ...extra) => [base[0], [...base[1], ...extra.filter(Boolean)]];
  switch(S.tab){
    case 'kiosco':
      if(S.kmode === 'sirena') return A.sirena;
      return v ? A.kioscoMe : A.kioscoWho;
    case 'guardia':
      if(!v) return A.guardiaWho;
      if(S.mode === 'guard') return A.guardiaForm;
      if(S.mode === 'cap' || S.mode === 'mant') return A.guardiaAct;
      if(S.mode === 'news') return mas(A.novIn, rol && A.novRol);
      if(S.mode === 'panel') return A.panelGuardia;
      if(S.mode === 'calif') return A.calMi;
      if(S.mode === 'legajo') return A.legMi;
      if(S.mode === 'tareas') return A.tarMis;
      return A.guardiaMe;
    case 'alertas':
      if(!v) return A.alertasOut;
      return mas(A.alertasIn, S.alr?.puede && A.alertasPuede, S.alr?.roja && A.alertasRoja);
    case 'sci':
      if(S.sciTab === 'hid') return A.sciHid;
      if(S.sciTab === 'cfg') return A.sciCfg;
      if(!v) return A.sciDotOut;
      if(S.sciSel && S.ptOpen === S.sciSel) return A.sciParte;
      if(S.sciSel) return S.sci?.puede ? A.sciSinPuede : A.sciSin;
      return mas(A.sciDot, S.sci?.puede && A.sciDotPuede);
    case 'epp':
      if(!v) return A.eppWho;
      if(S.eppTab === 'inv') return S.eppPer ? A.eppPer : A.eppInv;
      return { mis: A.eppMis, eq: A.eppEq, apr: A.eppApr, his: A.eppHis, cat: A.eppCat }[S.eppTab] || A.eppMis;
    case 'novedades':
      return v ? mas(A.novIn, rol && A.novRol) : A.novOut;
    case 'panel':
      if(!S.admin) return A.panelWho;
      if(S.ptab === 'tareas') return A.tarPanel;
      if(S.ptab === 'legajos') return S.legSel ? A.legPers : A.legLista;
      return { guardia: A.panelGuardia, asist: A.panelAsist, informes: A.panelInf, personal: A.panelPers, calif: A.panelCalif }[S.ptab] || A.panelGuardia;
  }
  return ['Ayuda', ['Elegí una sección arriba.']];
}
function ayudaBox(){
  if(!S.help) return '';
  const [t, lineas] = ayudaActual();
  return `<div class="helpbox" role="note"><div class="top"><h3>${t}</h3><button class="btn small outline" id="helpclose">Cerrar</button></div>
    ${lineas.map(l => `<p>${l}</p>`).join('')}</div>`;
}
