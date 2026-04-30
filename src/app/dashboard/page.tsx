'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { fetchSheetData, GIDS, Cliente, Ruta, parsePercentage, parseCurrency } from '@/lib/googleSheets';
import jsPDF from 'jspdf';

export default function DashboardPage() {
  const [user, setUser] = useState<Cliente | null>(null);
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Form State
  const [origen, setOrigen] = useState('');
  const [destino, setDestino] = useState('');
  const [capacidad, setCapacidad] = useState('');
  const [valorDeclarado, setValorDeclarado] = useState<number>(0);
  const [resultado, setResultado] = useState<any>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (!savedUser) {
      router.push('/');
      return;
    }
    setUser(JSON.parse(savedUser));

    const loadData = async () => {
      try {
        const data = await fetchSheetData<Ruta>(GIDS.RUTAS);
        setRutas(data);
      } catch (err) {
        console.error('Error loading routes:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [router]);

  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const handleLogout = () => {
    localStorage.removeItem('user');
    router.push('/');
  };

  const handleRegister = async (res: any) => {
    if (!res || !user) return;
    
    setSaving(true);
    try {
      await fetch('/api/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idCotizacion: res.idCotizacion,
          fecha: res.fecha || new Date().toLocaleString('es-CO'),
          cliente: user.Nombre_contacto,
          empresa: user.Empresa,
          origen,
          destino,
          capacidad,
          valorDeclarado,
          total: res.total
        })
      });
      console.log('Cotización registrada automáticamente');
    } catch (err) {
      console.error('Error al registrar automáticamente:', err);
    } finally {
      setSaving(false);
    }
  };

  // Memoized options for dropdowns
  const orígenesDisponibles = useMemo(() => {
    return Array.from(new Set(rutas.map((r) => r.Origen))).filter(Boolean);
  }, [rutas]);

  const destinosDisponibles = useMemo(() => {
    if (!origen) return [];
    return Array.from(new Set(rutas.filter((r) => r.Origen === origen).map((r) => r.Destino))).filter(Boolean);
  }, [rutas, origen]);

  const capacidadesDisponibles = useMemo(() => {
    if (rutas.length === 0) return [];
    // The keys that are not Origen or Destino are the capacities
    const firstRow = rutas[0];
    return Object.keys(firstRow).filter((k) => k !== 'Origen' && k !== 'Destino' && k.trim() !== '');
  }, [rutas]);

  const calcularCotizacion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!origen || !destino || !capacidad || !user) return;

    const rutaEncontrada = rutas.find((r) => r.Origen === origen && r.Destino === destino);
    if (!rutaEncontrada) return;

    const valorBaseStr = rutaEncontrada[capacidad];
    const valorBase = parseCurrency(valorBaseStr);
    const porcentajeSeguro = 0.01; // 1%
    const costoSeguro = valorDeclarado * porcentajeSeguro;
    
    const subtotal = valorBase + costoSeguro;
    const porcentajeDescuento = parsePercentage(user['%Descuento']);
    const valorDescuento = subtotal * porcentajeDescuento;
    
    // Redondear al entero superior
    const total = Math.ceil(subtotal - valorDescuento);
    const idCotizacion = `ML-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 100)}`;
    const fecha = new Date().toLocaleString('es-CO');

    const nuevoResultado = {
      idCotizacion,
      fecha,
      valorBase,
      costoSeguro,
      subtotal,
      porcentajeDescuento: user['%Descuento'],
      valorDescuento,
      total
    };

    setResultado(nuevoResultado);
    
    // Registro automático
    handleRegister(nuevoResultado);
  };

  const generatePDF = () => {
    if (!resultado || !user) return;

    const doc = new jsPDF();
    const logoUrl = '/logo.png';

    // Header
    try {
      doc.addImage(logoUrl, 'PNG', 10, 10, 50, 15);
    } catch (err) {
      console.error('Error adding logo to PDF:', err);
    }
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('Maslogistica S.A.S', 150, 15, { align: 'right' });
    doc.text('NIT: 901.123.456-7', 150, 20, { align: 'right' });
    doc.text('Cl. 37b #42 – 342, Itagüi', 150, 25, { align: 'right' });

    // Title
    doc.setFontSize(18);
    doc.setTextColor(0);
    doc.text('COTIZACIÓN FORMAL', 105, 50, { align: 'center' });
    doc.setFontSize(11);
    doc.text(`ID: ${resultado.idCotizacion}`, 105, 57, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Fecha: ${resultado.fecha}`, 105, 63, { align: 'center' });

    // Client Info
    doc.setDrawColor(200);
    doc.line(10, 70, 200, 70);
    doc.setFont('helvetica', 'bold');
    doc.text('DATOS DEL CLIENTE:', 10, 80);
    doc.setFont('helvetica', 'normal');
    doc.text(`Empresa: ${user.Empresa}`, 10, 87);
    doc.text(`Contacto: ${user.Nombre_contacto}`, 10, 92);

    // Quote Paragraph
    doc.setFont('helvetica', 'bold');
    doc.text('DETALLES DE LA COTIZACIÓN:', 10, 105);
    doc.setFont('helvetica', 'normal');
    
    const textoCotizacion = `El servicio de transporte desde ${origen} hacia ${destino} para un vehículo con capacidad de ${capacidad} y un valor de mercancía declarado en ${formatMoney(valorDeclarado)} tiene un costo total de ${formatMoney(resultado.total)}, sujeto a condiciones normales de transporte.`;
    
    doc.setFontSize(11);
    doc.text(textoCotizacion, 10, 115, { maxWidth: 190, lineHeightFactor: 1.5 });

    // Total Highlight
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

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(val);
  };

  if (loading || !user) {
    return <div className="flex-center" style={{ minHeight: '100vh' }}>Cargando datos...</div>;
  }

  return (
    <div className="container animate-fade-in">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
        <div>
          <h2 style={{ marginBottom: '0.25rem' }}>Bienvenido, {user.Nombre_contacto}</h2>
          <p style={{ color: 'var(--text-secondary)' }}>{user.Empresa}</p>
        </div>
        <button onClick={handleLogout} style={{ width: 'auto', padding: '0.5rem 1rem', background: 'transparent', border: '1px solid var(--error)', color: 'var(--error)' }}>
          Cerrar Sesión
        </button>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem' }}>
        {/* Formulario */}
        <div className="glass-card">
          <h3 style={{ marginBottom: '2rem' }}>Nueva Cotización</h3>
          <form onSubmit={calcularCotizacion}>
            <div className="input-group">
              <label>Origen</label>
              <select value={origen} onChange={(e) => setOrigen(e.target.value)} required>
                <option value="">Seleccione origen</option>
                {orígenesDisponibles.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>

            <div className="input-group">
              <label>Destino</label>
              <select value={destino} onChange={(e) => setDestino(e.target.value)} disabled={!origen} required>
                <option value="">Seleccione destino</option>
                {destinosDisponibles.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div className="input-group">
              <label>Capacidad del Vehículo</label>
              <select value={capacidad} onChange={(e) => setCapacidad(e.target.value)} required>
                <option value="">Seleccione capacidad</option>
                {capacidadesDisponibles.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="input-group">
              <label>Valor Declarado (COP$)</label>
              <input
                type="number"
                value={valorDeclarado || ''}
                onChange={(e) => setValorDeclarado(Number(e.target.value))}
                placeholder="Ej: 5000000"
                min="0"
                required
              />
            </div>

            <button type="submit">Calcular Valor</button>
          </form>
        </div>

        {/* Resultados */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ marginBottom: '2rem' }}>Resumen de Costos</h3>
          
          {resultado ? (
            <div style={{ flex: 1 }}>
              <div style={{ marginBottom: '2rem', lineHeight: '1.6', color: 'var(--text-primary)' }}>
                El servicio de transporte desde <strong style={{ color: 'var(--accent-primary)' }}>{origen}</strong> hacia <strong style={{ color: 'var(--accent-primary)' }}>{destino}</strong> para un vehículo con capacidad de <strong style={{ color: 'var(--accent-primary)' }}>{capacidad}</strong> y un valor de mercancía declarado en <strong style={{ color: 'var(--accent-primary)' }}>{formatMoney(valorDeclarado)}</strong> tiene un costo total de <strong style={{ color: 'var(--accent-primary)', fontSize: '1.2rem' }}>{formatMoney(resultado.total)}</strong>, sujeto a condiciones normales de transporte y usando la ruta principal entre origen y destino.
              </div>
              
              <div style={{ 
                marginTop: 'auto', 
                background: 'rgba(140, 198, 63, 0.1)', 
                padding: '1.5rem', 
                borderRadius: '1rem', 
                border: '1px solid var(--accent-primary)',
                textAlign: 'center'
              }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Total a Pagar</p>
                <h2 style={{ fontSize: '2.5rem', margin: 0, color: 'var(--accent-primary)' }}>{formatMoney(resultado.total)}</h2>
              </div>

              <div style={{ marginTop: '2rem' }}>
                <button 
                  onClick={generatePDF} 
                  style={{ 
                    background: 'var(--accent-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                  }}
                >
                  Descargar Cotización (PDF)
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-center" style={{ flex: 1, color: 'var(--text-secondary)', textAlign: 'center' }}>
              Complete el formulario para ver la cotización.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
