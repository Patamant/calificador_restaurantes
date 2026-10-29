/**
 * CONFIGURACIÓN DE LA APLICACIÓN
 * ------------------------------------------------------------------
 * API_URL: pegue aquí la URL de la implementación (Web App) de Google Apps Script,
 *          termina en /exec. Ejemplo:
 *          'https://script.google.com/macros/s/AKfycb.../exec'
 *          Si se deja vacía, la app funciona en MODO DEMOSTRACIÓN (datos solo en este navegador).
 *
 * IMPORTANTE: no escriba aquí la clave de acceso. La clave se ingresa en la pantalla de inicio
 * y se valida contra el servidor. Este archivo es público en GitHub.
 */
window.APP_CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbxU00jq6QxnTzs6c6dg3Bkq9Zy4K4pD0Hb2BidoEXE47ZgxFaFYit3KYIsmkirQ5H6Vew/exec',
  APP_NAME: 'Matriz de Evaluación de Restaurantes',
  COMPANY: 'FINAV – Financial Advisor',
  LOGO: 'assets/logo.png',
  LOGO_PDF: 'assets/logo.jpg',
  CURRENCY: 'USD',
  LOCALE: 'es-EC',
  // Parámetros por defecto (se reemplazan por los de la hoja "Config" al conectarse)
  DEFAULTS: {
    UMBRAL_CRITICO: 12, UMBRAL_ALTO: 8, UMBRAL_MEDIO: 4, BLOQUEANTE_MAX: 2,
    DICTAMEN_FAVORABLE: 0.8, DICTAMEN_CONDICIONADO: 0.6,
    PLAZO_CRITICO: 'Inmediato (0–7 días)', PLAZO_ALTO: 'Hasta 30 días',
    PLAZO_MEDIO: 'Hasta 90 días', PLAZO_BAJO: 'Mejora continua (monitorear)',
    EMPRESA: 'FINAV – Financial Advisor',
    PIE_INFORME: 'Informe confidencial preparado para uso exclusivo del cliente.'
  }
};
