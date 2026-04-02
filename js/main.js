/* ==========================================================================
   Giovanni Servicios IA - Motor JS Compartido
   Demo Landings - Modulos: ChatBot, TourGuide, Scroll, Navbar, Forms, Utils
   ========================================================================== */

'use strict';

/* --------------------------------------------------------------------------
   Utilidades
   -------------------------------------------------------------------------- */

/**
 * Elimina tildes de un string para comparacion flexible.
 * @param {string} str
 * @returns {string}
 */
function removeDiacritics(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Scroll suave hacia un elemento por su id.
 * @param {string} elementId - ID del elemento destino (sin #).
 * @param {number} [offset=80] - Offset en px desde el top.
 */
function smoothScrollTo(elementId, offset = 80) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top, behavior: 'smooth' });
}

/**
 * Efecto maquina de escribir sobre un elemento.
 * @param {HTMLElement} element - Elemento donde se escribe.
 * @param {string} text - Texto a escribir.
 * @param {number} [speed=50] - Milisegundos entre caracteres.
 * @returns {Promise<void>}
 */
function typewriterEffect(element, text, speed = 50) {
  return new Promise((resolve) => {
    element.textContent = '';
    let i = 0;
    const timer = setInterval(() => {
      element.textContent += text.charAt(i);
      i++;
      if (i >= text.length) {
        clearInterval(timer);
        resolve();
      }
    }, speed);
  });
}

/**
 * Animacion de contador numerico.
 * @param {HTMLElement} element - Elemento donde mostrar el numero.
 * @param {number} target - Valor final.
 * @param {number} [duration=2000] - Duracion en ms.
 */
function counterAnimation(element, target, duration = 2000) {
  const start = performance.now();
  const initial = 0;
  const suffix = element.dataset.suffix || '';
  const prefix = element.dataset.prefix || '';

  function update(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(initial + (target - initial) * eased);
    element.textContent = prefix + current.toLocaleString('es-AR') + suffix;
    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
}

/**
 * Obtiene la hora actual formateada HH:MM.
 * @returns {string}
 */
function getTimeString() {
  const now = new Date();
  return now.getHours().toString().padStart(2, '0') + ':' +
         now.getMinutes().toString().padStart(2, '0');
}

/* --------------------------------------------------------------------------
   ChatBot Engine
   -------------------------------------------------------------------------- */

/**
 * Motor de chatbot configurable con respuestas por keywords.
 *
 * @example
 * new ChatBot({
 *   botName: "Chef Giovanni",
 *   avatar: "&#127869;",
 *   welcomeMessage: "Hola! Soy el asistente...",
 *   responses: [
 *     { keywords: ["reserva", "mesa"], reply: "Para reservar..." }
 *   ],
 *   fallback: "No entendi tu consulta.",
 *   suggestions: ["Ver carta", "Reservar mesa"]
 * });
 */
class ChatBot {
  /**
   * @param {Object} config
   * @param {string} config.botName - Nombre del bot.
   * @param {string} config.avatar - Emoji o URL del avatar.
   * @param {string} config.welcomeMessage - Mensaje de bienvenida.
   * @param {Array<{keywords: string[], reply: string}>} config.responses - Respuestas por keywords.
   * @param {string} config.fallback - Respuesta por defecto.
   * @param {string[]} [config.suggestions] - Sugerencias rapidas.
   * @param {string} [config.accentColor] - Variable CSS de color (ej: --rest-gold).
   */
  constructor(config) {
    this.config = Object.assign({
      botName: 'Asistente',
      avatar: '&#128172;',
      welcomeMessage: 'Hola! En que puedo ayudarte?',
      responses: [],
      fallback: 'Disculpa, no entendi tu consulta. Podes reformularla?',
      suggestions: [],
      accentColor: null
    }, config);

    this._isOpen = false;
    this._isTyping = false;
    this._build();
    this._bind();
    this._sendBotMessage(this.config.welcomeMessage);
  }

  /** Construye el DOM del chatbot e inserta en el body. */
  _build() {
    // Bubble flotante
    this.bubble = document.createElement('button');
    this.bubble.className = 'chatbot-bubble';
    this.bubble.setAttribute('aria-label', 'Abrir chat de asistencia');
    this.bubble.innerHTML = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/><path d="M7 9h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z"/></svg>';

    // Ventana de chat
    this.window = document.createElement('div');
    this.window.className = 'chatbot-window';
    this.window.setAttribute('role', 'dialog');
    this.window.setAttribute('aria-label', 'Ventana de chat');

    // Header
    const header = document.createElement('div');
    header.className = 'chatbot-header';
    if (this.config.accentColor) {
      header.style.background = 'var(' + this.config.accentColor + ')';
    }
    header.innerHTML =
      '<div class="chatbot-header__avatar">' + this.config.avatar + '</div>' +
      '<div class="chatbot-header__info">' +
        '<div class="chatbot-header__name">' + this.config.botName + '</div>' +
        '<div class="chatbot-header__status">En linea</div>' +
      '</div>' +
      '<button class="chatbot-header__close" aria-label="Cerrar chat">&times;</button>';

    // Body (mensajes)
    this.body = document.createElement('div');
    this.body.className = 'chatbot-body';

    // Contenedor de sugerencias
    this.suggestionsContainer = document.createElement('div');
    this.suggestionsContainer.className = 'chatbot-suggestions';

    // Footer (input + send)
    const footer = document.createElement('div');
    footer.className = 'chatbot-footer';

    this.input = document.createElement('input');
    this.input.className = 'chatbot-footer__input';
    this.input.type = 'text';
    this.input.placeholder = 'Escribi tu mensaje...';
    this.input.setAttribute('aria-label', 'Escribir mensaje');

    this.sendBtn = document.createElement('button');
    this.sendBtn.className = 'chatbot-footer__send';
    this.sendBtn.setAttribute('aria-label', 'Enviar mensaje');
    this.sendBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';

    footer.appendChild(this.input);
    footer.appendChild(this.sendBtn);

    this.window.appendChild(header);
    this.window.appendChild(this.body);
    this.window.appendChild(this.suggestionsContainer);
    this.window.appendChild(footer);

    document.body.appendChild(this.bubble);
    document.body.appendChild(this.window);

    // Aplicar color accent al bubble y send si se configuro
    if (this.config.accentColor) {
      this.bubble.style.background = 'var(' + this.config.accentColor + ')';
      this.sendBtn.style.background = 'var(' + this.config.accentColor + ')';
    }

    // Renderizar sugerencias
    this._renderSuggestions();
  }

  /** Bindea todos los eventos del chatbot. */
  _bind() {
    this.bubble.addEventListener('click', () => this.toggle());

    this.window.querySelector('.chatbot-header__close')
      .addEventListener('click', () => this.close());

    this.sendBtn.addEventListener('click', () => this._handleSend());

    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._handleSend();
    });
  }

  /** Abre la ventana del chatbot. */
  open() {
    this._isOpen = true;
    this.window.classList.add('open');
    this.bubble.classList.add('hidden');
    this.input.focus();
  }

  /** Cierra la ventana del chatbot. */
  close() {
    this._isOpen = false;
    this.window.classList.remove('open');
    this.bubble.classList.remove('hidden');
  }

  /** Alterna abrir/cerrar. */
  toggle() {
    this._isOpen ? this.close() : this.open();
  }

  /** Renderiza los chips de sugerencias rapidas. */
  _renderSuggestions() {
    this.suggestionsContainer.innerHTML = '';
    if (!this.config.suggestions.length) return;

    this.config.suggestions.forEach((text) => {
      const chip = document.createElement('button');
      chip.className = 'chatbot-suggestions__chip';
      chip.textContent = text;
      chip.setAttribute('role', 'button');
      chip.addEventListener('click', () => {
        this._addMessage(text, 'user');
        this._processInput(text);
      });
      this.suggestionsContainer.appendChild(chip);
    });
  }

  /** Procesa el envio desde el input. */
  _handleSend() {
    const text = this.input.value.trim();
    if (!text || this._isTyping) return;
    this.input.value = '';
    this._addMessage(text, 'user');
    this._processInput(text);
  }

  /**
   * Agrega un mensaje al DOM del chat.
   * @param {string} text - Contenido del mensaje.
   * @param {'bot'|'user'} sender - Quien envia.
   */
  _addMessage(text, sender) {
    const msg = document.createElement('div');
    msg.className = 'chatbot-message ' + sender;

    const content = document.createElement('span');
    content.textContent = text;

    const time = document.createElement('span');
    time.className = 'chatbot-message__time';
    time.textContent = getTimeString();

    msg.appendChild(content);
    msg.appendChild(time);
    this.body.appendChild(msg);
    this._scrollToBottom();
  }

  /**
   * Envia un mensaje del bot con efecto de typing.
   * @param {string} text - Texto de respuesta del bot.
   */
  _sendBotMessage(text) {
    this._isTyping = true;

    // Indicador de typing
    const typing = document.createElement('div');
    typing.className = 'chatbot-typing';
    typing.innerHTML = '<span></span><span></span><span></span>';
    this.body.appendChild(typing);
    this._scrollToBottom();

    // Delay aleatorio entre 800 y 1500ms
    const delay = 800 + Math.random() * 700;

    setTimeout(() => {
      typing.remove();
      this._addMessage(text, 'bot');
      this._isTyping = false;
    }, delay);
  }

  /**
   * Busca la mejor respuesta por keywords (case insensitive, sin tildes).
   * @param {string} input - Texto del usuario.
   */
  _processInput(input) {
    const normalized = removeDiacritics(input.toLowerCase());
    let bestMatch = null;
    let bestScore = 0;

    for (const resp of this.config.responses) {
      let score = 0;
      for (const kw of resp.keywords) {
        const normalizedKw = removeDiacritics(kw.toLowerCase());
        if (normalized.includes(normalizedKw)) {
          score += normalizedKw.length; // mayor peso a keywords mas largas
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestMatch = resp;
      }
    }

    const reply = bestScore > 0 ? bestMatch.reply : this.config.fallback;
    this._sendBotMessage(reply);
  }

  /** Scroll automatico al ultimo mensaje. */
  _scrollToBottom() {
    requestAnimationFrame(() => {
      this.body.scrollTop = this.body.scrollHeight;
    });
  }
}

/* --------------------------------------------------------------------------
   Tour Guide System
   -------------------------------------------------------------------------- */

/**
 * Sistema de tour guiado interactivo con spotlight y tooltips.
 *
 * @example
 * new TourGuide({
 *   steps: [
 *     { element: "#hero", title: "Bienvenido", text: "Esto es...", position: "bottom" }
 *   ],
 *   onComplete: () => console.log("Tour completado")
 * });
 */
class TourGuide {
  /**
   * @param {Object} config
   * @param {Array<{element: string, title: string, text: string, position: string}>} config.steps
   * @param {Function} [config.onComplete] - Callback al finalizar el tour.
   * @param {boolean} [config.autoStart=false] - Iniciar automaticamente si es primera visita.
   * @param {string} [config.storageKey='giovanni-tour-done'] - Key para localStorage.
   */
  constructor(config) {
    this.config = Object.assign({
      steps: [],
      onComplete: null,
      autoStart: false,
      storageKey: 'giovanni-tour-done'
    }, config);

    this.currentStep = 0;
    this._active = false;
    this._build();

    if (this.config.autoStart && !this._hasCompleted()) {
      // Delay para que la pagina termine de renderizar
      setTimeout(() => this.start(), 1500);
    }
  }

  /**
   * Verifica si el tour ya fue completado (via localStorage).
   * @returns {boolean}
   */
  _hasCompleted() {
    try {
      return localStorage.getItem(this.config.storageKey) === 'true';
    } catch (e) {
      return false;
    }
  }

  /** Marca el tour como completado en localStorage. */
  _markComplete() {
    try {
      localStorage.setItem(this.config.storageKey, 'true');
    } catch (e) {
      // localStorage no disponible
    }
  }

  /** Construye los elementos DOM del tour (overlay, spotlight, tooltip). */
  _build() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'tour-overlay';

    this.spotlight = document.createElement('div');
    this.spotlight.className = 'tour-spotlight';

    this.tooltip = document.createElement('div');
    this.tooltip.className = 'tour-tooltip';
    this.tooltip.setAttribute('role', 'dialog');
    this.tooltip.setAttribute('aria-label', 'Tour guiado');

    document.body.appendChild(this.overlay);
    document.body.appendChild(this.spotlight);
    document.body.appendChild(this.tooltip);
  }

  /** Inicia el tour desde el paso 0. */
  start() {
    if (this._active || this.config.steps.length === 0) return;
    this._active = true;
    this.currentStep = 0;
    this.overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    this._showStep();
  }

  /** Finaliza el tour y restaura el estado. */
  end() {
    this._active = false;
    this.overlay.classList.remove('active');
    this.spotlight.style.display = 'none';
    this.tooltip.style.display = 'none';
    document.body.style.overflow = '';
    this._markComplete();
    if (typeof this.config.onComplete === 'function') {
      this.config.onComplete();
    }
  }

  /** Avanza al siguiente paso o finaliza si es el ultimo. */
  next() {
    if (this.currentStep < this.config.steps.length - 1) {
      this.currentStep++;
      this._showStep();
    } else {
      this.end();
    }
  }

  /** Retrocede al paso anterior. */
  prev() {
    if (this.currentStep > 0) {
      this.currentStep--;
      this._showStep();
    }
  }

  /** Muestra el paso actual: scroll, spotlight y tooltip. */
  _showStep() {
    const step = this.config.steps[this.currentStep];
    const el = document.querySelector(step.element);

    if (!el) {
      // Si el elemento no existe, saltear al siguiente
      this.next();
      return;
    }

    // Scroll suave al elemento
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Esperar a que termine el scroll antes de posicionar
    setTimeout(() => {
      this._positionSpotlight(el);
      this._renderTooltip(step, el);
    }, 400);
  }

  /**
   * Posiciona el spotlight sobre el elemento destacado.
   * @param {HTMLElement} el
   */
  _positionSpotlight(el) {
    const rect = el.getBoundingClientRect();
    const padding = 8;

    this.spotlight.style.display = 'block';
    this.spotlight.style.top = (rect.top - padding) + 'px';
    this.spotlight.style.left = (rect.left - padding) + 'px';
    this.spotlight.style.width = (rect.width + padding * 2) + 'px';
    this.spotlight.style.height = (rect.height + padding * 2) + 'px';
  }

  /**
   * Renderiza el contenido del tooltip y bindea botones.
   * @param {Object} step - Datos del paso actual.
   * @param {HTMLElement} el - Elemento destacado.
   */
  _renderTooltip(step, el) {
    const total = this.config.steps.length;
    const current = this.currentStep + 1;
    const isFirst = this.currentStep === 0;
    const isLast = this.currentStep === total - 1;

    this.tooltip.style.display = 'block';
    this.tooltip.setAttribute('data-position', step.position || 'bottom');

    this.tooltip.innerHTML =
      '<div class="tour-step-counter">Paso ' + current + ' de ' + total + '</div>' +
      '<div class="tour-tooltip__title">' + step.title + '</div>' +
      '<div class="tour-tooltip__text">' + step.text + '</div>' +
      '<div class="tour-actions">' +
        '<button class="tour-btn-skip" aria-label="Saltar tour">Saltar tour</button>' +
        '<div style="display:flex;gap:8px;align-items:center;">' +
          (!isFirst ? '<button class="tour-btn-prev" aria-label="Paso anterior">Anterior</button>' : '') +
          '<button class="tour-btn-next" aria-label="' + (isLast ? 'Finalizar tour' : 'Siguiente paso') + '">' +
            (isLast ? 'Finalizar' : 'Siguiente') +
          '</button>' +
        '</div>' +
      '</div>';

    // Bind botones
    this.tooltip.querySelector('.tour-btn-skip')
      .addEventListener('click', () => this.end());

    this.tooltip.querySelector('.tour-btn-next')
      .addEventListener('click', () => this.next());

    const prevBtn = this.tooltip.querySelector('.tour-btn-prev');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => this.prev());
    }

    // Posicionar tooltip respecto al elemento
    this._positionTooltip(el, step.position || 'bottom');
  }

  /**
   * Posiciona el tooltip respecto al elemento con clamp al viewport.
   * @param {HTMLElement} el - Elemento destacado.
   * @param {string} position - top | bottom | left | right
   */
  _positionTooltip(el, position) {
    const rect = el.getBoundingClientRect();
    const tooltipRect = this.tooltip.getBoundingClientRect();
    const gap = 16;
    var top, left;

    switch (position) {
      case 'top':
        top = rect.top - tooltipRect.height - gap;
        left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
        break;
      case 'bottom':
        top = rect.bottom + gap;
        left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
        break;
      case 'left':
        top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
        left = rect.left - tooltipRect.width - gap;
        break;
      case 'right':
        top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
        left = rect.right + gap;
        break;
      default:
        top = rect.bottom + gap;
        left = rect.left;
    }

    // Clamp dentro del viewport
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    left = Math.max(12, Math.min(left, vw - tooltipRect.width - 12));
    top = Math.max(12, Math.min(top, vh - tooltipRect.height - 12));

    this.tooltip.style.top = top + 'px';
    this.tooltip.style.left = left + 'px';
  }
}

/* --------------------------------------------------------------------------
   Scroll Animations (IntersectionObserver)
   -------------------------------------------------------------------------- */

/**
 * Inicializa animaciones al scroll con IntersectionObserver.
 * Elementos con clase .animate-on-scroll reciben .animated y .visible al entrar al viewport.
 * Soporta data-delay para stagger animations.
 */
function initScrollAnimations() {
  var elements = document.querySelectorAll('.animate-on-scroll');
  if (!elements.length) return;

  if (!('IntersectionObserver' in window)) {
    // Fallback: mostrar todo
    elements.forEach(function(el) {
      el.classList.add('visible');
      el.classList.add('animated');
    });
    return;
  }

  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        var el = entry.target;
        var delay = parseInt(el.getAttribute('data-delay'), 10) || 0;

        setTimeout(function() {
          el.classList.add('visible');
          el.classList.add('animated');
        }, delay);

        observer.unobserve(el);
      }
    });
  }, {
    threshold: 0.15,
    rootMargin: '0px 0px -40px 0px'
  });

  elements.forEach(function(el) { observer.observe(el); });
}

/**
 * Inicializa contadores animados.
 * Busca elementos con [data-count] o .counter[data-target].
 */
function initCounters() {
  // Soporte para data-count (legacy) y data-target (nuevo)
  var counters = document.querySelectorAll('[data-count], .counter[data-target]');
  if (!counters.length) return;

  if (!('IntersectionObserver' in window)) {
    counters.forEach(function(el) {
      var target = el.getAttribute('data-count') || el.getAttribute('data-target');
      el.textContent = target;
    });
    return;
  }

  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        var el = entry.target;
        var targetStr = el.getAttribute('data-count') || el.getAttribute('data-target');
        var prefix = el.getAttribute('data-prefix') || '';
        var suffix = el.getAttribute('data-suffix') || '';
        var num = parseInt(targetStr, 10);
        var duration = parseInt(el.getAttribute('data-duration'), 10) || 2000;

        if (isNaN(num)) {
          el.textContent = prefix + targetStr + suffix;
        } else {
          counterAnimation(el, num, duration);
        }

        observer.unobserve(el);
      }
    });
  }, { threshold: 0.5 });

  counters.forEach(function(el) { observer.observe(el); });
}

/* --------------------------------------------------------------------------
   Navbar Controller
   -------------------------------------------------------------------------- */

/**
 * Controla el comportamiento de la navbar al scroll y el menu mobile.
 * Soporta ambas convenciones: .navbar-scrolled y .scrolled.
 */
function initNavbar() {
  var navbar = document.querySelector('.navbar');
  if (!navbar) return;

  var SCROLL_THRESHOLD = 60;

  // Scroll handler con throttle via rAF
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function() {
      if (window.scrollY > SCROLL_THRESHOLD) {
        navbar.classList.add('scrolled');
        navbar.classList.add('navbar-scrolled');
      } else {
        navbar.classList.remove('scrolled');
        navbar.classList.remove('navbar-scrolled');
      }
      ticking = false;
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll(); // Verificar estado inicial

  // Mobile hamburger menu
  var hamburger = navbar.querySelector('.navbar__hamburger');
  var mobileMenu = document.querySelector('.navbar__mobile-menu') || document.querySelector('.mobile-nav');
  var overlay = document.querySelector('.navbar__mobile-overlay') || document.querySelector('.mobile-overlay');

  function toggleMobile() {
    if (!hamburger || !mobileMenu) return;
    var isOpen = mobileMenu.classList.contains('open');
    hamburger.classList.toggle('active');
    mobileMenu.classList.toggle('open');
    if (overlay) {
      overlay.classList.toggle('visible');
      overlay.classList.toggle('open');
    }
    document.body.style.overflow = isOpen ? '' : 'hidden';
  }

  function closeMobile() {
    if (!hamburger || !mobileMenu) return;
    hamburger.classList.remove('active');
    mobileMenu.classList.remove('open');
    if (overlay) {
      overlay.classList.remove('visible');
      overlay.classList.remove('open');
    }
    document.body.style.overflow = '';
  }

  if (hamburger) hamburger.addEventListener('click', toggleMobile);
  if (overlay) overlay.addEventListener('click', closeMobile);

  // Cerrar al clickear un link del menu mobile
  if (mobileMenu) {
    mobileMenu.querySelectorAll('a').forEach(function(link) {
      link.addEventListener('click', function() {
        if (mobileMenu.classList.contains('open')) closeMobile();
      });
    });
  }

  // Smooth scroll para anchor links dentro de la navbar
  navbar.querySelectorAll('a[href^="#"]').forEach(function(link) {
    link.addEventListener('click', function(e) {
      var targetId = link.getAttribute('href').slice(1);
      if (targetId) {
        e.preventDefault();
        smoothScrollTo(targetId, navbar.offsetHeight);
      }
    });
  });
}

/* --------------------------------------------------------------------------
   Form Handler
   -------------------------------------------------------------------------- */

/**
 * Manejador de formularios reutilizable con validacion y modal de confirmacion.
 *
 * @example
 * new FormHandler({
 *   formSelector: '#reservation-form',
 *   successTitle: 'Reserva confirmada!',
 *   successMessage: 'Te enviamos un email con los detalles.'
 * });
 */
class FormHandler {
  /**
   * @param {Object} config
   * @param {string} config.formSelector - Selector CSS del formulario.
   * @param {string} [config.successTitle] - Titulo del modal de exito.
   * @param {string} [config.successMessage] - Mensaje del modal.
   * @param {string} [config.successIcon] - Icono del modal.
   * @param {Function} [config.onSubmit] - Callback al enviar (recibe FormData).
   */
  constructor(config) {
    this.config = Object.assign({
      formSelector: 'form',
      successTitle: 'Enviado con exito!',
      successMessage: 'Nos pondremos en contacto a la brevedad.',
      successIcon: '&#10003;',
      onSubmit: null
    }, config);

    this.form = document.querySelector(this.config.formSelector);
    if (!this.form) return;

    this._bind();
  }

  /** Bindea el evento submit del formulario. */
  _bind() {
    var self = this;
    this.form.addEventListener('submit', function(e) {
      e.preventDefault();
      if (!self._validate()) return;

      var data = new FormData(self.form);

      if (typeof self.config.onSubmit === 'function') {
        self.config.onSubmit(data);
      }

      self._showSuccessModal();
      self.form.reset();
    });
  }

  /**
   * Validacion basica: campos required, email, telefono.
   * @returns {boolean}
   */
  _validate() {
    var valid = true;

    // Limpiar errores previos
    this.form.querySelectorAll('.form-input.error, input.error, textarea.error, select.error').forEach(function(el) {
      el.classList.remove('error');
    });
    this.form.querySelectorAll('.form-error').forEach(function(el) { el.remove(); });

    // Validar required
    this.form.querySelectorAll('[required]').forEach(function(field) {
      if (!field.value.trim()) {
        valid = false;
        field.classList.add('error');
        var errorEl = document.createElement('div');
        errorEl.className = 'form-error';
        errorEl.textContent = 'Este campo es obligatorio';
        field.parentNode.appendChild(errorEl);
      }
    });

    // Validar email
    this.form.querySelectorAll('input[type="email"]').forEach(function(field) {
      if (field.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.value)) {
        valid = false;
        field.classList.add('error');
        var errorEl = document.createElement('div');
        errorEl.className = 'form-error';
        errorEl.textContent = 'Ingresa un email valido';
        field.parentNode.appendChild(errorEl);
      }
    });

    // Validar telefono (minimo 8 digitos)
    this.form.querySelectorAll('input[type="tel"]').forEach(function(field) {
      if (field.value && field.value.replace(/\D/g, '').length < 8) {
        valid = false;
        field.classList.add('error');
        var errorEl = document.createElement('div');
        errorEl.className = 'form-error';
        errorEl.textContent = 'Ingresa un telefono valido';
        field.parentNode.appendChild(errorEl);
      }
    });

    return valid;
  }

  /** Muestra un modal animado de confirmacion de envio exitoso. */
  _showSuccessModal() {
    var config = this.config;
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';

    overlay.innerHTML =
      '<div class="modal">' +
        '<div class="modal__icon">' + config.successIcon + '</div>' +
        '<h3 class="modal__title">' + config.successTitle + '</h3>' +
        '<p class="modal__text">' + config.successMessage + '</p>' +
        '<button class="btn btn-primary btn--primary" aria-label="Cerrar modal">Entendido</button>' +
      '</div>';

    document.body.appendChild(overlay);

    // Cerrar modal
    function closeModal() {
      overlay.classList.remove('active');
      setTimeout(function() { overlay.remove(); }, 300);
    }

    overlay.querySelector('.btn').addEventListener('click', closeModal);
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) closeModal();
    });
  }
}

/* --------------------------------------------------------------------------
   Legacy: Typewriter auto-init para .typewriter
   -------------------------------------------------------------------------- */
function initLegacyTypewriter() {
  var el = document.querySelector('.typewriter');
  if (!el) return;
  var text = el.getAttribute('data-text') || el.textContent;
  el.textContent = '';
  el.style.borderRight = '2px solid var(--accent)';
  var i = 0;
  function typeChar() {
    if (i < text.length) {
      el.textContent += text.charAt(i);
      i++;
      setTimeout(typeChar, 45);
    } else {
      setTimeout(function() {
        el.style.borderRight = 'none';
      }, 2000);
    }
  }
  setTimeout(typeChar, 600);
}

/* --------------------------------------------------------------------------
   Legacy: Contact form placeholder handler
   -------------------------------------------------------------------------- */
function initLegacyContactForm() {
  var contactForm = document.getElementById('contact-form');
  if (!contactForm) return;

  contactForm.addEventListener('submit', function(e) {
    e.preventDefault();
    var btn = contactForm.querySelector('button[type="submit"]');
    if (!btn) return;
    var originalText = btn.textContent;
    btn.textContent = 'Enviando...';
    btn.disabled = true;

    setTimeout(function() {
      btn.textContent = 'Enviado!';
      contactForm.reset();
      setTimeout(function() {
        btn.textContent = originalText;
        btn.disabled = false;
      }, 2000);
    }, 1500);
  });
}

/* --------------------------------------------------------------------------
   Inicializacion Global
   -------------------------------------------------------------------------- */

document.addEventListener('DOMContentLoaded', function() {
  // Navbar
  initNavbar();

  // Scroll animations
  initScrollAnimations();

  // Animated counters
  initCounters();

  // Legacy typewriter
  initLegacyTypewriter();

  // Legacy contact form
  initLegacyContactForm();

  // Smooth scroll para todos los anchor links globales
  document.querySelectorAll('a[href^="#"]').forEach(function(link) {
    // Evitar duplicar listener si ya esta en la navbar
    if (link.closest('.navbar')) return;

    link.addEventListener('click', function(e) {
      var targetId = link.getAttribute('href').slice(1);
      if (targetId) {
        e.preventDefault();
        smoothScrollTo(targetId);
      }
    });
  });
});
