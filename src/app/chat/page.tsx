'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { fetchSheetData, GIDS, Cliente, Ruta, parsePercentage, parseCurrency } from '@/lib/googleSheets';
import jsPDF from 'jspdf';
import styles from './chat.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

type MessageRole = 'bot' | 'user';
type ChatStep =
  | 'login_username'
  | 'login_password'
  | 'menu'
  | 'origen'
  | 'destino'
  | 'capacidad'
  | 'valor_declarado'
  | 'resultado'
  | 'confirm_service'
  | 'direccion'
  | 'direccion_entrega'
  | 'fecha_recogida'
  | 'hora_recogida'
  | 'done';

interface Message {
  id: string;
  role: MessageRole;
  text: string;
  options?: string[];
  isTyping?: boolean;
  timestamp: Date;
}

interface QuoteResult {
  idCotizacion: string;
  fecha: string;
  valorBase: number;
  costoSeguro: number;
  subtotal: number;
  porcentajeDescuento: string;
  valorDescuento: number;
  total: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const uid = () => Math.random().toString(36).slice(2);

const formatMoney = (val: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val);

// ─── Component ────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const router = useRouter();

  // Data
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Auth
  const [user, setUser] = useState<Cliente | null>(null);
  const [pendingUsername, setPendingUsername] = useState('');

  // Selections
  const [origen, setOrigen] = useState('');
  const [destino, setDestino] = useState('');
  const [capacidad, setCapacidad] = useState('');
  const [valorDeclarado, setValorDeclarado] = useState<number>(0);
  const [resultado, setResultado] = useState<QuoteResult | null>(null);

  // Confirmation State
  const [direccion, setDireccion] = useState('');
  const [direccionEntrega, setDireccionEntrega] = useState('');
  const [fechaRecogida, setFechaRecogida] = useState('');
  const [horaRecogida, setHoraRecogida] = useState('');

  // Chat UI
  const [messages, setMessages] = useState<Message[]>([]);
  const [step, setStep] = useState<ChatStep>('login_username');
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [saving, setSaving] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ─── Scroll ────────────────────────────────────────────────────────────────

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // ─── Load data & check auth ─────────────────────────────────────────────────

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await fetchSheetData<Ruta>(GIDS.RUTAS);
        setRutas(data);
      } catch (err) {
        console.error('Error loading routes:', err);
      } finally {
        setDataLoaded(true);
      }
    };
    loadData();

    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      const parsed: Cliente = JSON.parse(savedUser);
      setUser(parsed);
    }
  }, []);

  // ─── Initial greeting ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!dataLoaded) return;

    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      const parsed: Cliente = JSON.parse(savedUser);
      addBotMessage(
        `¡Bienvenido de nuevo, **${parsed.Nombre_contacto}**! 👋\n¿Qué deseas hacer hoy?`,
        ['🚚 Nueva Cotización', '🚪 Cerrar Sesión'],
        'menu'
      );
    } else {
      addBotMessage(
        '¡Hola! Soy el asistente de **Maslogistica** 🚚\n\nPara continuar, necesito verificar tu identidad.\n\n¿Cuál es tu nombre de usuario?'
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataLoaded]);

  // ─── Options derived from data ──────────────────────────────────────────────

  const origenesDisponibles = Array.from(new Set(rutas.map((r) => r.Origen))).filter(Boolean);

  const destinosDisponibles = origen
    ? Array.from(new Set(rutas.filter((r) => r.Origen === origen).map((r) => r.Destino))).filter(Boolean)
    : [];

  const capacidadesDisponibles =
    rutas.length > 0
      ? Object.keys(rutas[0]).filter((k) => k !== 'Origen' && k !== 'Destino' && k.trim() !== '')
      : [];

  // ─── Message helpers ─────────────────────────────────────────────────────────

  const addBotMessage = useCallback(
    (text: string, options?: string[], nextStep?: ChatStep) => {
      const id = uid();
      setIsTyping(true);

      // Simulate typing delay based on text length
      const delay = Math.min(600 + text.length * 12, 2000);

      setTimeout(() => {
        setIsTyping(false);
        setMessages((prev) => [
          ...prev,
          { id, role: 'bot', text, options, timestamp: new Date() },
        ]);
        if (nextStep) setStep(nextStep);
      }, delay);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setStep]
  );

  const addUserMessage = useCallback((text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: uid(), role: 'user', text, timestamp: new Date() },
    ]);
  }, []);

  const saveQuotation = useCallback(async (res: QuoteResult, valDeclarado: number) => {
    if (!user) return;
    setSaving(true);
    try {
      await fetch('/api/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idCotizacion: res.idCotizacion,
          fecha: res.fecha,
          cliente: user.Nombre_contacto,
          empresa: user.Empresa,
          origen,
          destino,
          capacidad,
          valorDeclarado: valDeclarado,
          total: res.total,
        }),
      });
    } catch (err) {
      console.error('Error registering quotation:', err);
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, origen, destino, capacidad]);

  const registerConfirmation = useCallback(async (hora: string) => {
    if (!user || !resultado) return;
    setSaving(true);
    try {
      await fetch('/api/confirmations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idServicio: resultado.idCotizacion,
          fechaRegistro: new Date().toLocaleString('es-CO'),
          empresa: user.Empresa,
          cliente: user.Nombre_contacto,
          origen,
          destino,
          capacidad,
          total: resultado.total,
          direccion,
          direccionEntrega,
          fechaRecogida,
          horaRecogida: hora
        })
      });
      
      addBotMessage(
        `¡Confirmado! 🎉 Hemos registrado tu solicitud de transporte con el ID **${resultado.idCotizacion}**.\n\nUn asesor se pondrá en contacto contigo a la brevedad para finalizar los detalles.\n\n¿Deseas algo más?`,
        ['🏠 Menú', '🚪 Cerrar Sesión'],
        'menu'
      );
    } catch (err) {
      console.error('Error registering confirmation:', err);
      addBotMessage('⚠️ Hubo un problema al registrar la confirmación. Por favor intenta de nuevo.');
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, resultado, origen, destino, capacidad, direccion, direccionEntrega, fechaRecogida, addBotMessage]);

  const calcularYMostrar = useCallback(
    (valDeclarado: number) => {
      if (!user || !origen || !destino || !capacidad) return;

      const rutaEncontrada = rutas.find((r) => r.Origen === origen && r.Destino === destino);
      if (!rutaEncontrada) {
        addBotMessage('⚠️ No se encontró una tarifa para esta ruta. Contacta a tu asesor.');
        return;
      }

      const valorBaseStr = rutaEncontrada[capacidad];
      const valorBase = parseCurrency(valorBaseStr);
      const costoSeguro = valDeclarado * 0.01;
      const subtotal = valorBase + costoSeguro;
      const porcentajeDescuento = parsePercentage(user['%Descuento']);
      const valorDescuento = subtotal * porcentajeDescuento;
      const total = Math.ceil(subtotal - valorDescuento);
      const idCotizacion = `ML-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 100)}`;
      const fecha = new Date().toLocaleString('es-CO');

      const res: QuoteResult = {
        idCotizacion,
        fecha,
        valorBase,
        costoSeguro,
        subtotal,
        porcentajeDescuento: user['%Descuento'],
        valorDescuento,
        total,
      };

      setResultado(res);

      // Auto-save
      saveQuotation(res, valDeclarado);

      const descripcion = `El servicio de transporte desde ${origen} hasta ${destino}, en vehículo con capacidad de ${capacidad} y mercancía declarada por ${formatMoney(valDeclarado)}, tiene un costo total de **${formatMoney(total)}**, sujeto a condiciones normales de transporte usando la ruta principal entre origen y destino. Cotización válida por 15 días. No incluye cargues ni descargues adicionales ni tiempos de espera superiores a los pactados.`;

      const resumen = [
        `✅ ¡Tu cotización está lista!`,
        ``,
        `📦 **Origen:** ${origen}`,
        `📍 **Destino:** ${destino}`,
        `🚚 **Capacidad:** ${capacidad}`,
        ``,
        descripcion,
        ``,
        `💵 **Valor total del servicio: ${formatMoney(total)}**`,
        ``,
        `🏷️ **ID:** ${idCotizacion}   📅 ${fecha}`,
      ].join('\n');

      addBotMessage(resumen, ['✅ Confirmo el servicio', '📄 Descargar PDF', '🏠 Menú'], 'resultado');
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, origen, destino, capacidad, rutas, addBotMessage, saveQuotation]
  );

  // ─── Event handlers ───────────────────────────────────────────────────────────

  const handleOptionClick = (option: string) => {
    addUserMessage(option);

    switch (step) {
      case 'menu':
        if (option.includes('Nueva Cotización')) {
          addBotMessage(
            '¡Perfecto! Vamos a crear tu cotización. 📋\n\n¿Cuál es la ciudad de **origen** de tu envío?',
            origenesDisponibles,
            'origen'
          );
        } else if (option.includes('Cerrar Sesión')) {
          localStorage.removeItem('user');
          setUser(null);
          addBotMessage(
            '¡Hasta luego! 👋 Tu sesión ha sido cerrada.\n\nSi necesitas cotizar de nuevo, escribe tu usuario.',
            undefined,
            'login_username'
          );
        } else if (option.includes('Volver a intentar')) {
          setPendingUsername('');
          addBotMessage('¿Cuál es tu nombre de usuario?', undefined, 'login_username');
        }
        break;

      case 'origen':
        setOrigen(option);
        const destinos = Array.from(
          new Set(rutas.filter((r) => r.Origen === option).map((r) => r.Destino))
        ).filter(Boolean);
        addBotMessage(
          `Ciudad de origen: **${option}** ✅\n\n¿Cuál es el **destino** de tu envío?`,
          destinos,
          'destino'
        );
        break;

      case 'destino':
        setDestino(option);
        addBotMessage(
          `Destino: **${option}** ✅\n\n¿Qué capacidad de vehículo necesitas?`,
          capacidadesDisponibles,
          'capacidad'
        );
        break;

      case 'capacidad':
        setCapacidad(option);
        addBotMessage(
          `Capacidad: **${option}** ✅\n\nCasi listo. ¿Cuál es el **valor declarado de la mercancía** en COP?\n\nEscribe el monto (sin puntos ni comas):`,
          undefined,
          'valor_declarado'
        );
        setTimeout(() => inputRef.current?.focus(), 300);
        break;

      case 'resultado':
        if (option.includes('Confirmo el servicio')) {
          setStep('direccion');
          addBotMessage(
            '¡Excelente decisión! 🚀 Vamos a coordinar la recogida.\n\n¿Cuál es la **dirección exacta** del lugar de recogida?',
            undefined,
            'direccion'
          );
          setTimeout(() => inputRef.current?.focus(), 300);
        } else if (option.includes('Menú')) {
          addBotMessage(
            '¿Qué deseas hacer ahora?',
            ['🚚 Nueva Cotización', '🚪 Cerrar Sesión'],
            'menu'
          );
        }
        break;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const value = inputValue.trim();
    setInputValue('');

    switch (step) {
      case 'login_username': {
        addUserMessage(value);
        setSaving(true); // Reuse saving state for a "checking" feel
        try {
          const clients = await fetchSheetData<Cliente>(GIDS.CLIENTES);
          const userExists = clients.some((c) => c.Username.toLowerCase() === value.toLowerCase());
          
          if (!userExists) {
            addBotMessage(
              'No identificamos tu nombre de usuario en nuestra base de datos. 🛑\n\nSi eres cliente nuevo, contacta primero a servicio al cliente [haciendo click aquí](https://wa.me/573173534465).',
              ['🔄 Volver a intentar'],
              'login_username'
            );
          } else {
            setPendingUsername(value);
            addBotMessage(`Usuario: **${value}** ✅\n\nAhora ingresa tu **contraseña**:`, undefined, 'login_password');
          }
        } catch {
          addBotMessage('⚠️ Error al conectar con el servidor. Intenta de nuevo.', ['🔄 Volver a intentar'], 'login_username');
        } finally {
          setSaving(false);
        }
        break;
      }

      case 'login_password': {
        addUserMessage('••••••••');
        try {
          const clients = await fetchSheetData<Cliente>(GIDS.CLIENTES);
          const found = clients.find(
            (c) => c.Username.toLowerCase() === pendingUsername.toLowerCase() && c.Password === value
          );
          if (found) {
            localStorage.setItem('user', JSON.stringify(found));
            setUser(found);
            addBotMessage(
              `¡Bienvenido, **${found.Nombre_contacto}**! 🎉\nEmpresa: **${found.Empresa}**\n\n¿Qué deseas hacer?`,
              ['🚚 Nueva Cotización', '🚪 Cerrar Sesión'],
              'menu'
            );
          } else {
            addBotMessage(
              '❌ Contraseña incorrecta. Por favor, intenta de nuevo.',
              ['🔄 Volver a intentar'],
              'login_username'
            );
            setPendingUsername('');
          }
        } catch {
          addBotMessage(
            '⚠️ Error de conexión. Intenta de nuevo.',
            ['🔄 Volver a intentar'],
            'login_username'
          );
        }
        break;
      }

      case 'valor_declarado': {
        const num = parseFloat(value.replace(/[^0-9.]/g, ''));
        if (isNaN(num) || num < 0) {
          addUserMessage(value);
          addBotMessage('⚠️ Por favor ingresa un número válido mayor o igual a 0.');
          return;
        }
        addUserMessage(formatMoney(num));
        setValorDeclarado(num);
        calcularYMostrar(num);
        break;
      }

      case 'direccion': {
        addUserMessage(value);
        setDireccion(value);
        addBotMessage(
          'Dirección de recogida guardada. ✅\n\n¿Cuál es la **dirección exacta de entrega** en el destino?',
          undefined,
          'direccion_entrega'
        );
        break;
      }

      case 'direccion_entrega': {
        addUserMessage(value);
        setDireccionEntrega(value);
        addBotMessage(
          'Dirección de entrega registrada. ✅\n\n¿Para qué **fecha** deseas programar la recogida?',
          undefined,
          'fecha_recogida'
        );
        break;
      }

      case 'fecha_recogida': {
        addUserMessage(value);
        setFechaRecogida(value);
        addBotMessage(
          'Fecha programada. ✅\n\n¿A qué **hora** deberíamos pasar por la mercancía?',
          undefined,
          'hora_recogida'
        );
        break;
      }

      case 'hora_recogida': {
        addUserMessage(value);
        setHoraRecogida(value);
        registerConfirmation(value);
        break;
      }
    }
  };



  // ─── PDF Generation ────────────────────────────────────────────────────────

  const handleOptionAction = (option: string) => {
    if (option.includes('Descargar PDF')) {
      generatePDF();
      return;
    }
    handleOptionClick(option);
  };

  const generatePDF = () => {
    if (!resultado || !user) return;

    const doc = new jsPDF();

    try { doc.addImage('/logo.png', 'PNG', 10, 10, 50, 15); } catch {}

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('Maslogistica S.A.S', 150, 15, { align: 'right' });
    doc.text('NIT: 901.123.456-7', 150, 20, { align: 'right' });
    doc.text('Cl. 37b #42 – 342, Itagüi', 150, 25, { align: 'right' });

    doc.setFontSize(18);
    doc.setTextColor(0);
    doc.text('COTIZACIÓN FORMAL', 105, 50, { align: 'center' });
    doc.setFontSize(11);
    doc.text(`ID: ${resultado.idCotizacion}`, 105, 57, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Fecha: ${resultado.fecha}`, 105, 63, { align: 'center' });

    doc.setDrawColor(200);
    doc.line(10, 70, 200, 70);
    doc.setFont('helvetica', 'bold');
    doc.text('DATOS DEL CLIENTE:', 10, 80);
    doc.setFont('helvetica', 'normal');
    doc.text(`Empresa: ${user.Empresa}`, 10, 87);
    doc.text(`Contacto: ${user.Nombre_contacto}`, 10, 92);

    doc.setFont('helvetica', 'bold');
    doc.text('DETALLES DE LA COTIZACIÓN:', 10, 105);
    doc.setFont('helvetica', 'normal');

    const texto = `El servicio de transporte desde ${origen} hacia ${destino} para un vehículo con capacidad de ${capacidad} y un valor de mercancía declarado en ${formatMoney(valorDeclarado)} tiene un costo total de ${formatMoney(resultado.total)}, sujeto a condiciones normales de transporte.`;
    doc.setFontSize(11);
    doc.text(texto, 10, 115, { maxWidth: 190, lineHeightFactor: 1.5 });

    doc.setFillColor(140, 198, 63); // Brand Green
    doc.rect(10, 140, 190, 20, 'F');
    doc.setTextColor(255);
    doc.setFontSize(11);
    doc.text('VALOR TOTAL DEL SERVICIO:', 105, 147, { align: 'center' });
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(formatMoney(resultado.total), 105, 155, { align: 'center' });

    // Insurance and Legal Text
    doc.setTextColor(0);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    
    const legalText = "MASLOGISTICA tiene contratado un seguro que ampara sus obligaciones derivadas del contrato de transporte conforme los parámetros del código de comercio. Igualmente, nuestro usuario se compromete a contar con una póliza de mercancías para asegurar los riesgos y pérdidas de las mercancías objeto de las operaciones de transporte, por consiguiente, en caso de ocurrir algún siniestro durante el traslado de la mercancía, ustedes como nuestros clientes efectuarán el cobro de las pérdidas a su compañía de seguros y MASLOGISTICA atenderá la indemnización vía acción de subrogación por parte de su compañía aseguradora. MASLOGISTICA, se compromete a suministrar toda la información que esté bajo su control y que sea requerida por el cliente para ser presentada ante su aseguradora. Lo anterior por cuanto las condiciones de negociación y en especial el flete pactado tiene como aspecto fundamental este modelo indemnizatorio el cual es entendido y aceptado por el usuario.";
    
    doc.text('NOTAS IMPORTANTES Y SEGUROS:', 10, 170);
    doc.setFontSize(7.5);
    doc.text(legalText, 10, 175, { maxWidth: 190, textAlign: 'justify', lineHeightFactor: 1.3 });

    doc.setFont('helvetica', 'bold');
    doc.text('Seguro Opcional:', 10, 205);
    doc.setFont('helvetica', 'normal');
    doc.text('En caso de no disponer de póliza para el transporte de sus mercancías, podemos suministrarle una con tasa del 0.3% del valor declarado.', 35, 205);

    doc.setFont('helvetica', 'bold');
    doc.text('STAND BY:', 10, 215);
    doc.setFont('helvetica', 'normal');
    doc.text('Se consideran Stand By los tiempos adicionales a los tiempos libres, por causas imputables al cliente en proceso de Cargue, Descargue, aduanales, documentales. El costo dependerá de las situaciones de mercado.', 28, 215, { maxWidth: 172 });

    doc.setFont('helvetica', 'bold');
    doc.text('ANEXOS A LA VIGENCIA:', 10, 228);
    doc.setFont('helvetica', 'normal');
    doc.text('Esta oferta se mantendrá vigente siempre y cuando las condiciones de fletes en el mercado así lo permitan. Es importante clarificar, que si se presentan condiciones que inciden en las operaciones, las tarifas serán revisadas y notificadas al cliente.', 48, 228, { maxWidth: 152 });

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text('Contacto: +57 317 353 4465 | comercial@maslogistica.com.co', 105, 260, { align: 'center' });
    doc.text('Cl. 37b #42 – 342, La Independencia, Itagüi, Antioquia', 105, 265, { align: 'center' });

    doc.save(`Cotizacion_${resultado.idCotizacion}.pdf`);
  };

  // ─── Render markdown-like bold text ─────────────────────────────────────────

  const renderText = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, i) => {
      // Split by bold (**text**) and links ([text](url))
      const parts = line.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g);
      return (
        <span key={i}>
          {parts.map((part, j) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={j}>{part.slice(2, -2)}</strong>;
            }
            if (part.startsWith('[') && part.includes('](')) {
              const [linkText, url] = part.slice(1, -1).split('](');
              return (
                <a key={j} href={url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-secondary)', fontWeight: 'bold', textDecoration: 'underline' }}>
                  {linkText}
                </a>
              );
            }
            return <span key={j}>{part}</span>;
          })}
          {i < lines.length - 1 && <br />}
        </span>
      );
    });
  };

  // ─── Input visibility ─────────────────────────────────────────────────────

  const showInput = 
    step === 'login_username' || 
    step === 'login_password' || 
    step === 'valor_declarado' ||
    step === 'direccion' ||
    step === 'direccion_entrega' ||
    step === 'fecha_recogida' ||
    step === 'hora_recogida';

  const inputPlaceholder =
    step === 'login_username' ? 'Escribe tu usuario…' :
    step === 'login_password' ? 'Escribe tu contraseña…' :
    step === 'direccion' ? 'Dirección de recogida…' :
    step === 'direccion_entrega' ? 'Dirección de entrega…' :
    step === 'fecha_recogida' ? '' :
    step === 'hora_recogida' ? '' :
    'Escribe el valor declarado…';

  const inputType = 
    step === 'login_password' ? 'password' :
    step === 'valor_declarado' ? 'number' :
    step === 'fecha_recogida' ? 'date' :
    step === 'hora_recogida' ? 'time' :
    'text';

  // ─── JSX ──────────────────────────────────────────────────────────────────

  return (
    <div className={styles.chatRoot}>
      {/* Header */}
      <header className={styles.chatHeader}>
        <div className={styles.headerAvatar}>🚚</div>
        <div className={styles.headerInfo}>
          <span className={styles.headerName}>Asistente Maslogistica</span>
          <span className={styles.headerStatus}>
            <span className={styles.statusDot} />
            En línea
          </span>
        </div>
        {user && (
          <div className={styles.headerUser}>
            <span className={styles.headerUserName}>{user.Nombre_contacto}</span>
            <span className={styles.headerUserCompany}>{user.Empresa}</span>
          </div>
        )}
      </header>

      {/* Messages */}
      <div className={styles.chatMessages}>
        {!dataLoaded && (
          <div className={styles.loadingWrap}>
            <div className={styles.loadingDots}>
              <span /><span /><span />
            </div>
            <p>Conectando con Maslogistica…</p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`${styles.messageGroup} ${msg.role === 'user' ? styles.userGroup : styles.botGroup}`}>
            {msg.role === 'bot' && (
              <div className={styles.botAvatar}>🤖</div>
            )}
            <div className={styles.messageContent}>
              <div className={`${styles.bubble} ${msg.role === 'user' ? styles.userBubble : styles.botBubble}`}>
                {renderText(msg.text)}
              </div>

              {/* Option buttons */}
              {msg.options && msg.role === 'bot' && (
                <div className={styles.optionButtons}>
                  {msg.options.map((opt) => (
                    <button
                      key={opt}
                      className={styles.optionBtn}
                      onClick={() => handleOptionAction(opt)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className={`${styles.messageGroup} ${styles.botGroup}`}>
            <div className={styles.botAvatar}>🤖</div>
            <div className={styles.typingBubble}>
              <span /><span /><span />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <form className={styles.chatInput} onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type={inputType}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={showInput ? inputPlaceholder : 'Selecciona una opción arriba…'}
          disabled={!showInput || isTyping}
          className={styles.textInput}
          min={step === 'valor_declarado' ? '0' : undefined}
        />
        <button
          type="submit"
          disabled={!showInput || !inputValue.trim() || isTyping}
          className={styles.sendBtn}
          aria-label="Enviar"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </form>

      {saving && (
        <div className={styles.savingBar}>
          Guardando cotización en Google Sheets…
        </div>
      )}
    </div>
  );
}
