/**
 * FINAV – Matriz de Evaluación para Adquisición de Restaurantes
 * Backend (API) en Google Apps Script. Base de datos: este Google Sheet.
 *
 * Funciones principales:
 *   setup()            -> crea/actualiza las hojas y carga el catálogo inicial (ejecutar 1 vez).
 *   setAccessKey()     -> guarda la clave de acceso de la aplicación (editar el valor y ejecutar).
 *   doGet / doPost     -> API consumida por la aplicación web publicada en GitHub Pages.
 *
 * Versión: 1.0.0
 */

var APP_VERSION = '1.0.0';

var SHEETS = {
  CONFIG: 'Config',
  CATALOGO: 'Catalogo',
  EVALUACIONES: 'Evaluaciones',
  DETALLE: 'Detalle',
  LOG: 'Log'
};

var HEADERS = {
  Config: ['Clave', 'Valor', 'Descripción'],
  Catalogo: ['ID', 'Categoria', 'Item', 'QueVerificar', 'ImpOperacion', 'ImpAdquisicion', 'Bloqueante',
             'Accion', 'Responsable', 'Activo', 'Orden'],
  Evaluaciones: ['EvalID', 'Estado', 'Restaurante', 'Direccion', 'Ciudad', 'Propietario', 'FechaEvaluacion',
                 'Evaluador', 'PrecioOfertado', 'IndiceOperativo', 'IndiceAdquisicion', 'DictamenAdquisicion',
                 'DictamenOperacion', 'Calificados', 'NA', 'Pendientes', 'Criticos', 'Altos', 'Medios',
                 'BloqueantesIncumplidos', 'CostoTotal', 'CostoPreCierre', 'Conclusiones', 'CreadoEn',
                 'ActualizadoEn', 'Version'],
  Detalle: ['EvalID', 'ItemID', 'Categoria', 'Item', 'ImpOperacion', 'ImpAdquisicion', 'Bloqueante',
            'Calificacion', 'Observaciones', 'CostoEstimado', 'Brecha', 'RiesgoOperacion', 'RiesgoAdquisicion',
            'NivelOperacion', 'NivelAdquisicion', 'Prioridad', 'Estrategia', 'Accion', 'Plazo', 'Responsable',
            'ResponsableAsignado', 'FechaCompromiso', 'EstadoAccion'],
  Log: ['Fecha', 'Accion', 'EvalID', 'Detalle']
};

var DEFAULT_CONFIG = [
  ['UMBRAL_CRITICO', 12, 'Riesgo (brecha × importancia) a partir del cual el nivel es Crítico'],
  ['UMBRAL_ALTO', 8, 'Riesgo a partir del cual el nivel es Alto'],
  ['UMBRAL_MEDIO', 4, 'Riesgo a partir del cual el nivel es Medio (por debajo y >0: Bajo)'],
  ['BLOQUEANTE_MAX', 2, 'Un ítem bloqueante se incumple si su calificación es ≤ a este valor'],
  ['DICTAMEN_FAVORABLE', 0.8, 'Índice mínimo para dictamen Favorable / Apto'],
  ['DICTAMEN_CONDICIONADO', 0.6, 'Índice mínimo para dictamen Condicionado / Apto con plan'],
  ['PLAZO_CRITICO', 'Inmediato (0–7 días)', 'Plazo sugerido para nivel Crítico'],
  ['PLAZO_ALTO', 'Hasta 30 días', 'Plazo sugerido para nivel Alto'],
  ['PLAZO_MEDIO', 'Hasta 90 días', 'Plazo sugerido para nivel Medio'],
  ['PLAZO_BAJO', 'Mejora continua (monitorear)', 'Plazo sugerido para nivel Bajo'],
  ['EMPRESA', 'FINAV – Financial Advisor', 'Nombre que aparece en el informe'],
  ['PIE_INFORME', 'Informe confidencial preparado para uso exclusivo del cliente.', 'Texto del pie del informe PDF']
];

// Catálogo inicial (129 ítems). Se carga en la hoja "Catalogo" con setup().
var SEED_CATALOG = [
  ["MOB-01", "01. Mobiliario del salón", "Mesas – estructura y estabilidad", "Sin cojeo, sin óxido, uniones firmes, niveladores", 4, 3, "No", "Reparar/nivelar o reemplazar mesas dañadas; inventariar unidades a reponer.", "Mantenimiento"],
  ["MOB-02", "01. Mobiliario del salón", "Mesas – superficie y acabado", "Cubiertas sin rayones, quemaduras, desprendimientos; fáciles de limpiar", 3, 2, "No", "Restaurar o recubrir superficies; definir protocolo de limpieza y protección.", "Mantenimiento"],
  ["MOB-03", "01. Mobiliario del salón", "Sillas – estructura y seguridad", "Patas, soldaduras y uniones firmes; sin riesgo de caída", 5, 3, "No", "Retirar de uso sillas inseguras de inmediato; reparar o reemplazar.", "Mantenimiento"],
  ["MOB-04", "01. Mobiliario del salón", "Sillas – tapizado y asiento", "Tapiz sin roturas, manchas o desgaste excesivo", 3, 2, "No", "Retapizar o reemplazar; cotizar lote completo para uniformidad.", "Mantenimiento"],
  ["MOB-05", "01. Mobiliario del salón", "Barra / counter de atención", "Estructura, acabado, funcionalidad", 3, 2, "No", "Reparar acabados y estructura de barra; evaluar rediseño funcional.", "Mantenimiento"],
  ["MOB-06", "01. Mobiliario del salón", "Cantidad de mobiliario vs. inventario declarado", "Conteo físico coincide con lo ofertado por el vendedor y con el aforo", 3, 5, "No", "Conciliar inventario físico vs. declarado; ajustar precio por faltantes.", "Comprador"],
  ["MOB-07", "01. Mobiliario del salón", "Mobiliario de terraza / exterior (si aplica)", "Estado, resistencia a intemperie, permiso de uso de espacio público", 2, 3, "No", "Reparar o reemplazar; verificar permiso de uso de espacio público.", "Administrador"],
  ["MOB-08", "01. Mobiliario del salón", "Estaciones de servicio y aparadores", "Muebles de apoyo para meseros, carros, aparadores", 3, 2, "No", "Reparar o adquirir estaciones de servicio necesarias.", "Mantenimiento"],
  ["ACC-01", "02. Accesorios y menaje de producción", "Ollas, sartenes y bandejas", "Sin abolladuras, recubrimientos íntegros, cantidad suficiente", 4, 2, "No", "Reponer piezas dañadas o con recubrimiento desprendido; completar dotación.", "Jefe de cocina"],
  ["ACC-02", "02. Accesorios y menaje de producción", "Cuchillería y tablas de corte", "Filo, mangos íntegros, tablas por código de colores", 4, 2, "No", "Afilar/reponer cuchillos; implementar tablas por código de colores.", "Jefe de cocina"],
  ["ACC-03", "02. Accesorios y menaje de producción", "Utensilios menores", "Pinzas, cucharones, batidores, espátulas en buen estado", 3, 1, "No", "Completar y reponer utensilios menores.", "Jefe de cocina"],
  ["ACC-04", "02. Accesorios y menaje de producción", "Recipientes de almacenamiento", "Gastronorms y contenedores con tapa, aptos para alimentos", 4, 2, "No", "Adquirir contenedores grado alimenticio con tapa; descartar los deteriorados.", "Jefe de cocina"],
  ["ACC-05", "02. Accesorios y menaje de producción", "Balanzas y termómetros", "Funcionamiento y calibración vigente", 4, 2, "No", "Calibrar o reemplazar; establecer verificación periódica.", "Jefe de cocina"],
  ["ACC-06", "02. Accesorios y menaje de producción", "Vajilla, cubertería y cristalería", "Inventario, piezas despostilladas, uniformidad", 4, 3, "No", "Descartar piezas despostilladas; reponer y conciliar inventario.", "Administrador"],
  ["ACC-07", "02. Accesorios y menaje de producción", "Estanterías y anaqueles", "Acero inoxidable o material sanitario, sin óxido, estables", 3, 2, "No", "Reemplazar estanterías oxidadas o inestables por material sanitario.", "Mantenimiento"],
  ["ACC-08", "02. Accesorios y menaje de producción", "Mesas de trabajo de acero inoxidable", "Superficies sin corrosión, estables, sanitarias", 4, 2, "No", "Reparar o reemplazar mesas de trabajo deterioradas.", "Mantenimiento"],
  ["EQP-01", "03. Equipos de producción", "Cocina / estufa / quemadores", "Encendido, llama uniforme, válvulas sin fugas", 5, 4, "No", "Mantenimiento correctivo inmediato por técnico calificado; prueba de fugas.", "Mantenimiento"],
  ["EQP-02", "03. Equipos de producción", "Hornos", "Temperatura real vs. programada, sellos, controles", 5, 4, "No", "Calibrar termostato, cambiar empaques/controles o reemplazar equipo.", "Mantenimiento"],
  ["EQP-03", "03. Equipos de producción", "Freidoras", "Termostato, seguridad, estado de cubas", 4, 3, "No", "Revisar termostato y sistema de seguridad; reparar o reemplazar.", "Mantenimiento"],
  ["EQP-04", "03. Equipos de producción", "Plancha / parrilla / salamandra", "Calentamiento uniforme, superficie, controles", 4, 3, "No", "Mantenimiento correctivo; rectificar superficie o reemplazar.", "Mantenimiento"],
  ["EQP-05", "03. Equipos de producción", "Campana extractora y filtros", "Succión efectiva, filtros limpios, ductos sin grasa acumulada", 5, 4, "No", "Limpieza profunda de ductos y filtros; revisar motor; contratar limpieza periódica.", "Mantenimiento"],
  ["EQP-06", "03. Equipos de producción", "Refrigeradores", "Temperatura ≤ 5 °C, empaques, compresor", 5, 4, "No", "Servicio técnico de refrigeración; cambiar empaques; registrar temperaturas.", "Mantenimiento"],
  ["EQP-07", "03. Equipos de producción", "Congeladores", "Temperatura ≤ -18 °C, escarcha, compresor", 5, 4, "No", "Servicio técnico; descongelar y revisar sellos; registrar temperaturas.", "Mantenimiento"],
  ["EQP-08", "03. Equipos de producción", "Cuarto frío (si aplica)", "Temperatura, aislamiento, puerta, evaporador", 5, 5, "No", "Diagnóstico técnico integral; cotizar reparación antes del cierre.", "Mantenimiento"],
  ["EQP-09", "03. Equipos de producción", "Mesas refrigeradas / saladette", "Temperatura de operación, cajones, empaques", 4, 3, "No", "Servicio técnico y reemplazo de empaques.", "Mantenimiento"],
  ["EQP-10", "03. Equipos de producción", "Lavavajillas", "Temperatura de lavado/enjuague, dosificación químicos", 4, 3, "No", "Mantenimiento; calibrar dosificación; verificar temperaturas.", "Mantenimiento"],
  ["EQP-11", "03. Equipos de producción", "Equipos menores (licuadoras, procesadores, batidoras)", "Funcionamiento, seguridad eléctrica", 3, 2, "No", "Reparar o reemplazar equipos menores.", "Jefe de cocina"],
  ["EQP-12", "03. Equipos de producción", "Cafetera / máquina espresso", "Presión, temperatura, descalcificación", 3, 3, "No", "Mantenimiento por técnico; verificar si es propia o en comodato del proveedor.", "Administrador"],
  ["EQP-13", "03. Equipos de producción", "Máquina de hielo / dispensadores de bebidas", "Funcionamiento, higiene, propiedad (comodato)", 3, 3, "No", "Limpieza/sanitización; verificar titularidad o comodato con proveedor.", "Administrador"],
  ["EQP-14", "03. Equipos de producción", "Registros de mantenimiento y garantías", "Historial de mantenimiento, facturas, garantías vigentes", 3, 4, "No", "Solicitar al vendedor historial y facturas; crear plan de mantenimiento preventivo.", "Vendedor (pre-cierre)"],
  ["EQP-15", "03. Equipos de producción", "Antigüedad y vida útil remanente de equipos", "Años de uso vs. vida útil estimada", 3, 5, "No", "Valorar equipos por vida útil remanente; ajustar precio y presupuestar reposición.", "Comprador"],
  ["EQP-16", "03. Equipos de producción", "Titularidad de equipos (propios vs. comodato/leasing)", "Facturas a nombre del vendedor, sin prendas ni comodatos no declarados", 3, 5, "Sí", "Exigir facturas y certificado de no gravamen; excluir del precio lo que no sea propio.", "Legal"],
  ["INP-01", "04. Instalaciones – Área de producción", "Pisos del área de producción", "Antideslizantes, sin grietas, uniones sanitarias, pendiente a desagües", 4, 3, "No", "Reparar grietas y juntas; evaluar recubrimiento sanitario antideslizante.", "Mantenimiento"],
  ["INP-02", "04. Instalaciones – Área de producción", "Paredes y techos", "Lavables, sin humedad, sin desprendimientos", 4, 3, "No", "Tratar humedades; pintura/recubrimiento lavable.", "Mantenimiento"],
  ["INP-03", "04. Instalaciones – Área de producción", "Instalación eléctrica", "Tablero rotulado, breakers, cableado protegido, puesta a tierra", 5, 5, "No", "Inspección por electricista certificado; corregir riesgos antes de operar.", "Mantenimiento"],
  ["INP-04", "04. Instalaciones – Área de producción", "Instalación de gas", "Tuberías, reguladores, válvulas, ubicación de cilindros/tanque, certificación", 5, 5, "Sí", "Prueba de hermeticidad y certificación por técnico autorizado antes del cierre.", "Vendedor (pre-cierre)"],
  ["INP-05", "04. Instalaciones – Área de producción", "Agua potable, presión y agua caliente", "Suministro continuo, presión, calentador, cisterna", 5, 4, "No", "Revisar bomba, cisterna y calentador; reparar fugas.", "Mantenimiento"],
  ["INP-06", "04. Instalaciones – Área de producción", "Desagües y trampa de grasa", "Sin obstrucciones ni olores, trampa de grasa operativa y limpia", 5, 4, "No", "Limpieza y mantenimiento de trampa de grasa; destapar desagües; contrato periódico.", "Mantenimiento"],
  ["INP-07", "04. Instalaciones – Área de producción", "Ventilación e iluminación de cocina", "Iluminación suficiente con protección, renovación de aire", 4, 3, "No", "Mejorar iluminación con luminarias protegidas; revisar extracción/inyección.", "Mantenimiento"],
  ["INP-08", "04. Instalaciones – Área de producción", "Lavamanos exclusivos para personal", "Con jabón, desinfectante, toallas desechables, señalética", 4, 2, "No", "Instalar/dotar lavamanos y señalética de lavado de manos.", "Jefe de cocina"],
  ["INP-09", "04. Instalaciones – Área de producción", "Control de plagas", "Contrato vigente, certificados, ausencia de evidencias", 5, 4, "No", "Contratar fumigación certificada; sellar accesos; mantener registros.", "Administrador"],
  ["INP-10", "04. Instalaciones – Área de producción", "Gestión de residuos", "Contenedores con tapa, separación, área de acopio", 4, 2, "No", "Implementar separación y área de acopio; contenedores con tapa y pedal.", "Jefe de cocina"],
  ["INP-11", "04. Instalaciones – Área de producción", "Bodega seca", "Orden, ventilación, estanterías separadas del piso", 4, 2, "No", "Reorganizar bodega; instalar estanterías y aplicar PEPS/FIFO.", "Jefe de cocina"],
  ["INP-12", "04. Instalaciones – Área de producción", "Vestidores y baños del personal", "Separados de producción, limpios, casilleros", 3, 2, "No", "Adecuar vestidores y baños del personal.", "Administrador"],
  ["INP-13", "04. Instalaciones – Área de producción", "Flujo de trabajo (layout)", "Flujo sin cruces entre crudo/cocido y sucio/limpio", 4, 3, "No", "Rediseñar layout para evitar contaminación cruzada.", "Jefe de cocina"],
  ["INS-01", "05. Instalaciones – Salón y baños", "Pisos del salón", "Sin roturas, antideslizantes, limpios", 3, 3, "No", "Reparar o reemplazar piezas dañadas.", "Mantenimiento"],
  ["INS-02", "05. Instalaciones – Salón y baños", "Paredes, techos y pintura", "Sin humedad, fisuras ni manchas", 3, 3, "No", "Tratar humedades y pintar.", "Mantenimiento"],
  ["INS-03", "05. Instalaciones – Salón y baños", "Iluminación del salón", "Luminarias funcionando, ambiente adecuado", 3, 2, "No", "Reponer luminarias; evaluar cambio a LED.", "Mantenimiento"],
  ["INS-04", "05. Instalaciones – Salón y baños", "Climatización y ventilación", "Equipos de A/C o ventilación operativos, sin olores de cocina", 3, 3, "No", "Mantenimiento de equipos; corregir migración de olores.", "Mantenimiento"],
  ["INS-05", "05. Instalaciones – Salón y baños", "Baños de clientes", "Sanitarios, lavamanos, grifería, insumos, limpieza", 4, 3, "No", "Reparar sanitarios y grifería; establecer rutina de limpieza.", "Mantenimiento"],
  ["INS-06", "05. Instalaciones – Salón y baños", "Accesos y accesibilidad", "Rampas, puertas, accesibilidad para personas con discapacidad", 3, 3, "No", "Adecuar accesos según normativa de accesibilidad.", "Administrador"],
  ["INS-07", "05. Instalaciones – Salón y baños", "Fachada y exteriores", "Estado de fachada, visibilidad, limpieza", 3, 3, "No", "Mantenimiento de fachada; mejorar visibilidad comercial.", "Mantenimiento"],
  ["INS-08", "05. Instalaciones – Salón y baños", "Puertas, ventanas y vidrios", "Cerraduras, vidrios sin roturas, seguridad", 3, 3, "No", "Reparar cerraduras y vidrios; cambiar claves/llaves tras la compra.", "Mantenimiento"],
  ["INS-09", "05. Instalaciones – Salón y baños", "Estado estructural del local", "Sin fisuras estructurales, filtraciones de cubierta", 4, 5, "Sí", "Inspección técnica por ingeniero; exigir reparación al arrendador/vendedor antes del cierre.", "Vendedor (pre-cierre)"],
  ["CAJ-01", "06. Área de cajas", "Mobiliario del área de caja", "Counter, cajones con llave, ergonomía", 3, 2, "No", "Reparar o adecuar mobiliario de caja con cajones seguros.", "Mantenimiento"],
  ["CAJ-02", "06. Área de cajas", "Gaveta de dinero y caja fuerte", "Funcionamiento, cerraduras, cambio de claves", 4, 3, "No", "Cambiar combinaciones/llaves al recibir; reparar gaveta.", "Administrador"],
  ["CAJ-03", "06. Área de cajas", "Equipos de cómputo de caja", "PC/tablet, impresora de tickets y comandas", 5, 3, "No", "Reparar o reemplazar equipos; configurar respaldo.", "Administrador"],
  ["CAJ-04", "06. Área de cajas", "Software de punto de venta (sistema de restaurante)", "Licencia, propiedad, soporte, transferibilidad de datos y recetas", 5, 4, "No", "Confirmar licencia transferible o contratar nueva; exportar datos históricos.", "Administrador"],
  ["CAJ-05", "06. Área de cajas", "Procedimientos de apertura, arqueo y cierre de caja", "Documentados y aplicados, con registros", 4, 3, "No", "Documentar e implementar procedimiento de arqueo diario.", "Administrador"],
  ["CAJ-06", "06. Área de cajas", "Seguridad del área de caja", "Cámara enfocada, acceso restringido, manejo de efectivo", 4, 2, "No", "Instalar cámara y restringir acceso; política de retiro de efectivo.", "Administrador"],
  ["CAJ-07", "06. Área de cajas", "Conectividad a internet y respaldo", "Proveedor, velocidad, plan de contingencia", 4, 2, "No", "Contratar plan con respaldo (segundo proveedor o datos móviles).", "Administrador"],
  ["SEG-01", "07. Seguridad y emergencias", "Extintores", "Tipo adecuado (K para cocina), carga vigente, ubicación señalizada", 5, 4, "No", "Recargar o adquirir extintores; incluir tipo K en cocina.", "Seguridad/SSO"],
  ["SEG-02", "07. Seguridad y emergencias", "Sistema de supresión de incendios en campana", "Existencia y mantenimiento vigente (si aplica)", 4, 4, "No", "Instalar o dar mantenimiento al sistema de supresión.", "Seguridad/SSO"],
  ["SEG-03", "07. Seguridad y emergencias", "Señalética, rutas de evacuación y luces de emergencia", "Señalización visible, luces operativas", 4, 3, "No", "Instalar señalética y luces de emergencia.", "Seguridad/SSO"],
  ["SEG-04", "07. Seguridad y emergencias", "Salidas de emergencia", "Libres de obstáculos, apertura hacia afuera", 5, 4, "No", "Despejar y adecuar salidas de emergencia.", "Seguridad/SSO"],
  ["SEG-05", "07. Seguridad y emergencias", "Botiquín de primeros auxilios", "Completo y vigente", 3, 1, "No", "Dotar botiquín completo y capacitar al personal.", "Seguridad/SSO"],
  ["SEG-06", "07. Seguridad y emergencias", "CCTV y alarma", "Cámaras operativas, grabación, monitoreo, claves", 3, 2, "No", "Reparar sistema; cambiar claves y titularidad del monitoreo.", "Administrador"],
  ["SEG-07", "07. Seguridad y emergencias", "Permiso / informe de Bomberos", "Vigente y a nombre del establecimiento", 5, 5, "Sí", "Obtener o renovar permiso de Bomberos antes del cierre.", "Vendedor (pre-cierre)"],
  ["ENS-01", "08. Muebles, enseres y tecnología", "Televisores", "Funcionamiento, soportes, controles", 2, 2, "No", "Reparar o reemplazar; asegurar soportes.", "Administrador"],
  ["ENS-02", "08. Muebles, enseres y tecnología", "Equipos de sonido, parlantes y amplificador", "Funcionamiento, cableado, licencias de música", 2, 2, "No", "Reparar equipos; regularizar pago de derechos por música ambiental si aplica.", "Administrador"],
  ["ENS-03", "08. Muebles, enseres y tecnología", "Letreros y rótulos", "Estado, iluminación, permiso de publicidad exterior", 3, 3, "No", "Reparar rótulo; verificar permiso de publicidad exterior.", "Administrador"],
  ["ENS-04", "08. Muebles, enseres y tecnología", "Pantallas / menú boards", "Funcionamiento y contenido actualizado", 2, 1, "No", "Reparar y actualizar contenido.", "Marketing"],
  ["ENS-05", "08. Muebles, enseres y tecnología", "Decoración y elementos de ambientación", "Estado, coherencia con el concepto", 2, 2, "No", "Renovar elementos deteriorados.", "Marketing"],
  ["ENS-06", "08. Muebles, enseres y tecnología", "Equipos de oficina", "Computadora administrativa, impresora, archivo", 2, 2, "No", "Reparar o reemplazar equipos de oficina.", "Administrador"],
  ["ENS-07", "08. Muebles, enseres y tecnología", "Red WiFi para clientes", "Router, cobertura, seguridad separada de la red de caja", 2, 1, "No", "Separar red de clientes y red operativa; mejorar cobertura.", "Administrador"],
  ["ENS-08", "08. Muebles, enseres y tecnología", "Generador eléctrico / UPS", "Respaldo eléctrico para caja y refrigeración", 3, 3, "No", "Instalar UPS para caja y evaluar generador para refrigeración.", "Mantenimiento"],
  ["PER-01", "09. Administrativo – Personal", "Contratos de trabajo escritos y registrados", "Contratos firmados y registrados en el sistema del Ministerio del Trabajo", 4, 5, "No", "Regularizar contratos antes del cierre; definir si se sustituye al empleador.", "Legal"],
  ["PER-02", "09. Administrativo – Personal", "Afiliación a la seguridad social (IESS) al día", "Todos afiliados desde el primer día, sin mora patronal", 4, 5, "Sí", "Exigir certificado de no adeudar al IESS; pagar mora antes del cierre.", "Vendedor (pre-cierre)"],
  ["PER-03", "09. Administrativo – Personal", "Pago de beneficios sociales", "Décimos, vacaciones, utilidades, fondos de reserva al día", 4, 5, "No", "Liquidar valores pendientes; retener del precio los pasivos identificados.", "Contador"],
  ["PER-04", "09. Administrativo – Personal", "Pasivos laborales y liquidaciones pendientes", "Indemnizaciones, desahucios, jubilación patronal (antigüedad)", 3, 5, "Sí", "Cuantificar pasivos; liquidar o descontar del precio con cláusula de indemnidad.", "Legal"],
  ["PER-05", "09. Administrativo – Personal", "Juicios o reclamos laborales", "Demandas, denuncias o inspecciones abiertas", 3, 5, "Sí", "Solicitar certificado de juicios; cláusula de responsabilidad del vendedor.", "Legal"],
  ["PER-06", "09. Administrativo – Personal", "Roles de pago y nómina", "Roles firmados, coherentes con contratos y declaraciones", 3, 4, "No", "Revisar últimos 12 meses de roles; corregir inconsistencias.", "Contador"],
  ["PER-07", "09. Administrativo – Personal", "Reglamento interno y seguridad y salud ocupacional", "Reglamentos aprobados, comité/delegado, exámenes", 3, 3, "No", "Elaborar o actualizar reglamentos y plan de SSO.", "Talento humano"],
  ["PER-08", "09. Administrativo – Personal", "Certificados de salud y capacitación en manipulación de alimentos", "Vigentes para todo el personal de cocina y servicio", 4, 3, "No", "Gestionar certificados y capacitación en BPM.", "Talento humano"],
  ["PER-09", "09. Administrativo – Personal", "Dependencia de personal clave", "Chef/recetas documentadas, intención de permanencia", 4, 4, "No", "Entrevistar personal clave; acordar permanencia o transición y documentar recetas.", "Comprador"],
  ["PER-10", "09. Administrativo – Personal", "Rotación y clima laboral", "Rotación de los últimos 12 meses, ausentismo", 3, 2, "No", "Plan de retención y comunicación del cambio de dueño.", "Talento humano"],
  ["POS-01", "10. Administrativo – POS y medios de pago", "Datáfonos/POS – estado y funcionamiento", "Equipos operativos, conectividad, impresión de voucher", 5, 3, "No", "Solicitar reemplazo al adquirente o adquirir nuevos equipos.", "Administrador"],
  ["POS-02", "10. Administrativo – POS y medios de pago", "Titularidad de contratos con adquirentes/bancos", "A nombre de quién están; ¿son transferibles?", 5, 4, "No", "Tramitar nuevos contratos de afiliación a nombre del comprador antes del traspaso.", "Administrador"],
  ["POS-03", "10. Administrativo – POS y medios de pago", "Comisiones y condiciones contractuales", "Tasas, cargos fijos, penalidades por terminación", 3, 3, "No", "Comparar tasas del mercado y renegociar.", "Administrador"],
  ["POS-04", "10. Administrativo – POS y medios de pago", "Conciliación de ventas con tarjeta vs. depósitos", "Cuadre de ventas reportadas, liquidaciones y depósitos", 3, 5, "No", "Conciliar 6–12 meses de liquidaciones para validar ventas declaradas.", "Contador"],
  ["POS-05", "10. Administrativo – POS y medios de pago", "Pagos digitales (transferencias, QR, billeteras)", "Cuentas habilitadas y a nombre de quién", 3, 2, "No", "Habilitar medios de pago digitales a nombre del nuevo titular.", "Administrador"],
  ["POS-06", "10. Administrativo – POS y medios de pago", "Plataformas de delivery", "Contratos, comisiones, cuentas, calificaciones", 3, 4, "No", "Verificar transferibilidad de cuentas y calificaciones; renegociar contratos.", "Administrador"],
  ["CON-01", "11. Administrativo – Contabilidad y facturación", "Facturación electrónica autorizada", "Firma electrónica, sistema autorizado por el SRI, secuenciales", 5, 4, "No", "Obtener firma electrónica y sistema de facturación a nombre del comprador.", "Contador"],
  ["CON-02", "11. Administrativo – Contabilidad y facturación", "Software contable", "Licencia, propiedad, posibilidad de exportar información", 3, 3, "No", "Definir sistema contable propio; exportar historial del vendedor.", "Contador"],
  ["CON-03", "11. Administrativo – Contabilidad y facturación", "Estados financieros últimos 2–3 años", "Disponibles, firmados y coherentes con declaraciones", 2, 5, "No", "Solicitar EEFF y revisarlos con contador independiente.", "Contador"],
  ["CON-04", "11. Administrativo – Contabilidad y facturación", "Declaraciones tributarias al día", "IVA, renta, retenciones, anexos", 3, 5, "Sí", "Exigir certificado de cumplimiento tributario y regularización previa.", "Vendedor (pre-cierre)"],
  ["CON-05", "11. Administrativo – Contabilidad y facturación", "Deudas o procesos tributarios abiertos", "Glosas, multas, coactivas", 3, 5, "Sí", "Exigir pago o descuento del precio; cláusula de indemnidad tributaria.", "Legal"],
  ["CON-06", "11. Administrativo – Contabilidad y facturación", "Control de inventarios y costeo de recetas", "Kardex, recetas estándar, costo de alimentos (food cost)", 4, 3, "No", "Implementar kardex y recetas estándar con costeo.", "Jefe de cocina"],
  ["CON-07", "11. Administrativo – Contabilidad y facturación", "Cuentas por pagar a proveedores", "Saldos, antigüedad, acuerdos", 3, 5, "No", "Obtener detalle de saldos; definir quién asume cada deuda en el contrato.", "Contador"],
  ["CON-08", "11. Administrativo – Contabilidad y facturación", "Coherencia de ventas declaradas vs. reales", "Ventas en sistema vs. declaraciones vs. bancos", 2, 5, "No", "Due diligence de ventas; ajustar valoración según ventas comprobables.", "Contador"],
  ["ARR-01", "12. Arriendo, permisos y legal", "Contrato de arriendo vigente y escrito", "Contrato firmado, inscrito si aplica", 5, 5, "Sí", "Exigir contrato escrito; sin él no proceder.", "Legal"],
  ["ARR-02", "12. Arriendo, permisos y legal", "Plazo remanente y opción de renovación", "Años restantes suficientes para recuperar la inversión", 4, 5, "No", "Negociar ampliación de plazo con el arrendador antes del cierre.", "Legal"],
  ["ARR-03", "12. Arriendo, permisos y legal", "Cláusula de cesión o autorización del arrendador", "Permite traspaso o subarriendo; autorización escrita", 4, 5, "Sí", "Obtener autorización escrita del arrendador o nuevo contrato a nombre del comprador.", "Legal"],
  ["ARR-04", "12. Arriendo, permisos y legal", "Canon de arriendo y reajustes", "Valor vs. mercado y vs. ventas (idealmente ≤ 8–12 % de ventas)", 4, 4, "No", "Renegociar canon o reajustes; reflejar en valoración.", "Comprador"],
  ["ARR-05", "12. Arriendo, permisos y legal", "Garantía y pagos de arriendo al día", "Sin atrasos; garantía devolvible o transferible", 3, 4, "No", "Certificado de pagos al día del arrendador; acordar tratamiento de la garantía.", "Legal"],
  ["ARR-06", "12. Arriendo, permisos y legal", "Uso de suelo compatible", "Actividad de restaurante permitida en la zona", 5, 5, "Sí", "Obtener informe de compatibilidad de uso de suelo.", "Legal"],
  ["ARR-07", "12. Arriendo, permisos y legal", "Licencia/permiso municipal de funcionamiento", "Vigente (p. ej. LUAE en Quito) y transferible", 5, 5, "Sí", "Renovar/obtener a nombre del comprador; condicionar el cierre.", "Legal"],
  ["ARR-08", "12. Arriendo, permisos y legal", "Permisos sanitarios y de turismo", "Permiso sanitario, registro/categoría turística según aplique", 5, 4, "No", "Tramitar o actualizar permisos a nombre del comprador.", "Legal"],
  ["ARR-09", "12. Arriendo, permisos y legal", "Patente municipal, tasas y servicios básicos al día", "Sin deudas de patente, agua, luz, gas, internet", 3, 4, "No", "Exigir certificados de no adeudar y cortes de cuenta a la fecha de cierre.", "Vendedor (pre-cierre)"],
  ["ARR-10", "12. Arriendo, permisos y legal", "Marca y nombre comercial", "Registro de marca a nombre del vendedor e inclusión en la venta", 3, 5, "No", "Incluir cesión de marca en el contrato; verificar registro ante la autoridad de propiedad intelectual.", "Legal"],
  ["ARR-11", "12. Arriendo, permisos y legal", "Contratos con proveedores y exclusividades", "Exclusividades, comodatos, penalidades", 3, 4, "No", "Revisar y renegociar contratos; identificar penalidades.", "Legal"],
  ["ARR-12", "12. Arriendo, permisos y legal", "Seguros", "Pólizas de incendio, robo, responsabilidad civil", 3, 3, "No", "Contratar pólizas a nombre del comprador desde el día del cierre.", "Administrador"],
  ["ARR-13", "12. Arriendo, permisos y legal", "Gravámenes, prendas o embargos sobre activos", "Certificado de no gravamen de bienes muebles", 2, 5, "Sí", "Exigir levantamiento de gravámenes antes del cierre.", "Legal"],
  ["ARR-14", "12. Arriendo, permisos y legal", "Estructura de la transacción", "Compra de activos vs. compra de acciones/participaciones", 2, 5, "No", "Definir con abogado la estructura que limite la herencia de pasivos.", "Legal"],
  ["INO-01", "13. Inocuidad y calidad", "Manual de buenas prácticas de manufactura (BPM)", "Documentado e implementado", 4, 3, "No", "Elaborar/actualizar manual BPM y capacitar.", "Jefe de cocina"],
  ["INO-02", "13. Inocuidad y calidad", "Registros de temperatura", "Recepción, almacenamiento, cocción y mantenimiento", 4, 2, "No", "Implementar formatos diarios de control de temperaturas.", "Jefe de cocina"],
  ["INO-03", "13. Inocuidad y calidad", "Rotulado, fechas y rotación PEPS/FIFO", "Productos rotulados con fecha; sin vencidos", 5, 2, "No", "Descartar vencidos; implementar rotulado y PEPS.", "Jefe de cocina"],
  ["INO-04", "13. Inocuidad y calidad", "Programa de limpieza y desinfección", "Cronograma, químicos aprobados, registros", 4, 2, "No", "Implementar programa con registros y químicos rotulados.", "Jefe de cocina"],
  ["INO-05", "13. Inocuidad y calidad", "Calidad del agua", "Análisis, limpieza de cisterna, filtros", 4, 3, "No", "Limpiar cisterna, instalar filtros y realizar análisis de agua.", "Mantenimiento"],
  ["INO-06", "13. Inocuidad y calidad", "Recepción y evaluación de proveedores de alimentos", "Criterios de aceptación, proveedores calificados", 4, 2, "No", "Definir criterios de recepción y evaluar proveedores.", "Jefe de cocina"],
  ["COM-01", "14. Comercial y continuidad del negocio", "Ventas históricas y tendencia", "Ventas mensuales de 24 meses; tendencia y estacionalidad", 3, 5, "No", "Basar la valoración en ventas comprobadas; ajustar precio si la tendencia es negativa.", "Comprador"],
  ["COM-02", "14. Comercial y continuidad del negocio", "Rentabilidad (EBITDA / utilidad operativa)", "Margen real después de arriendo, personal y costo de alimentos", 3, 5, "No", "Construir estado de resultados normalizado y valorar por múltiplo.", "Contador"],
  ["COM-03", "14. Comercial y continuidad del negocio", "Reputación online", "Calificación en Google, redes, plataformas de reseñas", 3, 4, "No", "Plan de gestión de reputación; responder reseñas.", "Marketing"],
  ["COM-04", "14. Comercial y continuidad del negocio", "Menú y recetas estandarizadas", "Recetas documentadas, fichas técnicas, fotos", 4, 4, "No", "Exigir entrega de recetas y fichas técnicas como parte de la compra.", "Jefe de cocina"],
  ["COM-05", "14. Comercial y continuidad del negocio", "Proveedores y cadena de suministro", "Proveedores alternos, condiciones de crédito", 4, 3, "No", "Identificar proveedores alternos y acordar condiciones con el nuevo dueño.", "Administrador"],
  ["COM-06", "14. Comercial y continuidad del negocio", "Ubicación, tráfico y estacionamiento", "Flujo de personas, competencia, parqueo", 3, 4, "No", "Analizar entorno y competencia; ajustar estrategia comercial.", "Comprador"],
  ["COM-07", "14. Comercial y continuidad del negocio", "Redes sociales, dominio y cuentas digitales", "Accesos y titularidad transferibles", 3, 4, "No", "Incluir en el contrato la entrega de accesos y titularidad de cuentas.", "Marketing"],
  ["COM-08", "14. Comercial y continuidad del negocio", "Base de datos de clientes y programas de fidelización", "Existencia, consentimiento de datos personales", 2, 3, "No", "Verificar consentimiento conforme a la ley de protección de datos; migrar base.", "Marketing"],
  ["COM-09", "14. Comercial y continuidad del negocio", "Período de acompañamiento del vendedor", "Compromiso de transición y no competencia", 3, 4, "No", "Pactar acompañamiento (p. ej. 30–60 días) y cláusula de no competencia.", "Legal"]
];

/* ===================================================================== */
/*  INSTALACIÓN                                                          */
/* ===================================================================== */

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(HEADERS).forEach(function (name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    sh.getRange(1, 1, 1, HEADERS[name].length).setValues([HEADERS[name]])
      .setFontWeight('bold').setBackground('#0B2A5B').setFontColor('#FFFFFF');
    sh.setFrozenRows(1);
  });

  var cfg = ss.getSheetByName(SHEETS.CONFIG);
  if (cfg.getLastRow() < 2) {
    cfg.getRange(2, 1, DEFAULT_CONFIG.length, 3).setValues(DEFAULT_CONFIG);
  }

  var cat = ss.getSheetByName(SHEETS.CATALOGO);
  if (cat.getLastRow() < 2) {
    var rows = SEED_CATALOG.map(function (r, i) {
      return [r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], 'Sí', i + 1];
    });
    cat.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  }

  // Formato de columnas para evitar conversiones automáticas
  ss.getSheetByName(SHEETS.DETALLE).getRange('B:B').setNumberFormat('@');
  ss.getSheetByName(SHEETS.EVALUACIONES).getRange('A:A').setNumberFormat('@');

  var hoja1 = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
  if (hoja1 && ss.getSheets().length > 1 && hoja1.getLastRow() === 0) ss.deleteSheet(hoja1);

  if (!PropertiesService.getScriptProperties().getProperty('ACCESS_KEY')) {
    PropertiesService.getScriptProperties().setProperty('ACCESS_KEY', 'CAMBIAR-ESTA-CLAVE');
  }
  logAction_('setup', '', 'Hojas creadas/verificadas');
  return 'Setup completado';
}

/** Edite el valor y ejecute esta función para fijar la clave de acceso de la aplicación. */
function setAccessKey() {
  var NUEVA_CLAVE = 'Escriba-aqui-su-clave-segura';
  PropertiesService.getScriptProperties().setProperty('ACCESS_KEY', NUEVA_CLAVE);
  return 'Clave actualizada';
}

/* ===================================================================== */
/*  API                                                                  */
/* ===================================================================== */

function doGet(e) {
  var p = (e && e.parameter) || {};
  return handle_(p.action || 'ping', p, null);
}

function doPost(e) {
  var body = {};
  try { body = JSON.parse(e.postData.contents || '{}'); } catch (err) { return json_({ ok: false, error: 'JSON inválido' }); }
  return handle_(body.action, body, body);
}

function handle_(action, params, body) {
  try {
    if (action === 'version') return json_({ ok: true, version: APP_VERSION });
    if (!checkKey_(params.key)) return json_({ ok: false, error: 'Clave de acceso inválida', code: 'AUTH' });
    switch (action) {
      case 'ping':    return json_({ ok: true, version: APP_VERSION, empresa: getConfig_().EMPRESA });
      case 'catalog': return json_({ ok: true, catalog: getCatalog_(), config: getConfig_() });
      case 'list':    return json_({ ok: true, evaluations: listEvaluations_() });
      case 'get':     return json_(getEvaluation_(params.id));
      case 'save':    return json_(saveEvaluation_(body));
      case 'delete':  return json_(deleteEvaluation_(params.id));
      default:        return json_({ ok: false, error: 'Acción no reconocida: ' + action });
    }
  } catch (err) {
    logAction_('error', '', String(err && err.stack || err));
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function checkKey_(key) {
  var real = PropertiesService.getScriptProperties().getProperty('ACCESS_KEY');
  return !!real && String(key || '') === real;
}

/* ===================================================================== */
/*  LECTURA                                                              */
/* ===================================================================== */

function sheet_(name) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error('No existe la hoja "' + name + '". Ejecute setup().');
  return sh;
}

function readObjects_(name) {
  var sh = sheet_(name);
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var head = values[0];
  return values.slice(1).filter(function (r) { return r.join('') !== ''; }).map(function (r) {
    var o = {};
    head.forEach(function (h, i) {
      var v = r[i];
      if (v instanceof Date) v = Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      o[h] = v;
    });
    return o;
  });
}

function getConfig_() {
  var out = {};
  readObjects_(SHEETS.CONFIG).forEach(function (r) { out[r.Clave] = r.Valor; });
  return out;
}

function getCatalog_() {
  return readObjects_(SHEETS.CATALOGO)
    .filter(function (r) { return String(r.Activo).toLowerCase().indexOf('s') === 0; })
    .sort(function (a, b) { return Number(a.Orden) - Number(b.Orden); })
    .map(function (r) {
      return { id: String(r.ID), categoria: r.Categoria, item: r.Item, verificar: r.QueVerificar,
               impOp: Number(r.ImpOperacion), impAdq: Number(r.ImpAdquisicion), bloqueante: r.Bloqueante === 'Sí',
               accion: r.Accion, responsable: r.Responsable };
    });
}

function listEvaluations_() {
  return readObjects_(SHEETS.EVALUACIONES).map(function (r) {
    return { id: r.EvalID, estado: r.Estado, restaurante: r.Restaurante, fecha: r.FechaEvaluacion,
             evaluador: r.Evaluador, indiceOp: r.IndiceOperativo, indiceAdq: r.IndiceAdquisicion,
             dictamenAdq: r.DictamenAdquisicion, actualizado: r.ActualizadoEn };
  }).sort(function (a, b) { return String(b.actualizado).localeCompare(String(a.actualizado)); });
}

function getEvaluation_(id) {
  if (!id) return { ok: false, error: 'Falta el ID' };
  var head = readObjects_(SHEETS.EVALUACIONES).filter(function (r) { return r.EvalID === id; })[0];
  if (!head) return { ok: false, error: 'Evaluación no encontrada' };
  var items = readObjects_(SHEETS.DETALLE).filter(function (r) { return r.EvalID === id; }).map(function (r) {
    return { id: String(r.ItemID), calificacion: r.Calificacion === '' ? '' : String(r.Calificacion),
             observaciones: r.Observaciones, costo: r.CostoEstimado === '' ? '' : Number(r.CostoEstimado),
             responsableAsignado: r.ResponsableAsignado, fechaCompromiso: r.FechaCompromiso,
             estadoAccion: r.EstadoAccion };
  });
  return {
    ok: true,
    evaluation: {
      id: head.EvalID, estado: head.Estado, restaurante: head.Restaurante, direccion: head.Direccion,
      ciudad: head.Ciudad, propietario: head.Propietario, fecha: head.FechaEvaluacion, evaluador: head.Evaluador,
      precio: head.PrecioOfertado, conclusiones: head.Conclusiones, creado: head.CreadoEn, actualizado: head.ActualizadoEn
    },
    items: items
  };
}

/* ===================================================================== */
/*  ESCRITURA                                                            */
/* ===================================================================== */

function saveEvaluation_(body) {
  var ev = body.evaluation || {}, rs = body.results || {}, items = body.items || [];
  if (!ev.restaurante) return { ok: false, error: 'El nombre del restaurante es obligatorio' };
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    var id = ev.id || ('EV-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss') +
                       '-' + Math.floor(Math.random() * 900 + 100));
    var shE = sheet_(SHEETS.EVALUACIONES);
    var data = shE.getDataRange().getValues();
    var rowIndex = -1, creado = now;
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === id) { rowIndex = i + 1; creado = data[i][23] || now; break; }
    }
    var headRow = [id, ev.estado || 'Borrador', ev.restaurante, ev.direccion || '', ev.ciudad || '', ev.propietario || '',
      ev.fecha || '', ev.evaluador || '', num_(ev.precio), num_(rs.indiceOp), num_(rs.indiceAdq),
      rs.dictamenAdq || '', rs.dictamenOp || '', rs.calificados || 0, rs.na || 0, rs.pendientes || 0,
      rs.criticos || 0, rs.altos || 0, rs.medios || 0, rs.bloqueantes || 0, num_(rs.costoTotal), num_(rs.costoPre),
      ev.conclusiones || '', creado, now, APP_VERSION];
    if (rowIndex > 0) shE.getRange(rowIndex, 1, 1, headRow.length).setValues([headRow]);
    else shE.appendRow(headRow);

    // Detalle: se reemplazan las filas de esta evaluación
    var shD = sheet_(SHEETS.DETALLE);
    var det = shD.getDataRange().getValues();
    var keep = [det[0]];
    for (var j = 1; j < det.length; j++) if (det[j][0] !== id) keep.push(det[j]);
    var newRows = items.map(function (it) {
      return [id, it.id, it.categoria, it.item, it.impOp, it.impAdq, it.bloqueante ? 'Sí' : 'No',
        it.calificacion === undefined ? '' : it.calificacion, it.observaciones || '', num_(it.costo), blank_(it.brecha),
        blank_(it.riesgoOp), blank_(it.riesgoAdq), it.nivelOp || '', it.nivelAdq || '', it.prioridad || '',
        it.estrategia || '', it.accion || '', it.plazo || '', it.responsable || '', it.responsableAsignado || '',
        it.fechaCompromiso || '', it.estadoAccion || ''];
    });
    var all = keep.concat(newRows);
    shD.clearContents();
    shD.getRange(1, 1, all.length, HEADERS.Detalle.length).setValues(all);
    shD.getRange(1, 1, 1, HEADERS.Detalle.length).setFontWeight('bold').setBackground('#0B2A5B').setFontColor('#FFFFFF');

    logAction_('save', id, (ev.estado || 'Borrador') + ' · ' + items.length + ' ítems');
    return { ok: true, id: id, actualizado: now };
  } finally {
    lock.releaseLock();
  }
}

function deleteEvaluation_(id) {
  if (!id) return { ok: false, error: 'Falta el ID' };
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    [SHEETS.EVALUACIONES, SHEETS.DETALLE].forEach(function (name) {
      var sh = sheet_(name), v = sh.getDataRange().getValues();
      for (var i = v.length - 1; i >= 1; i--) if (v[i][0] === id) sh.deleteRow(i + 1);
    });
    logAction_('delete', id, '');
    return { ok: true };
  } finally { lock.releaseLock(); }
}

function num_(v) { return (v === '' || v === null || v === undefined || isNaN(Number(v))) ? '' : Number(v); }
function blank_(v) { return (v === null || v === undefined) ? '' : v; }

function logAction_(accion, id, detalle) {
  try {
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.LOG);
    if (sh) sh.appendRow([new Date(), accion, id, String(detalle).slice(0, 500)]);
  } catch (e) { /* sin bloqueo */ }
}

/** Prueba rápida desde el editor: verifica que el catálogo se lee correctamente. */
function testCatalogo() {
  var c = getCatalog_();
  Logger.log('Ítems activos en catálogo: ' + c.length);
  Logger.log(JSON.stringify(c[0]));
}
