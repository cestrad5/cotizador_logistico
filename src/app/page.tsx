'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchSheetData, GIDS, Cliente } from '@/lib/googleSheets';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    // Check if already logged in
    const user = localStorage.getItem('user');
    if (user) {
      router.push('/dashboard');
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const clients = await fetchSheetData<Cliente>(GIDS.CLIENTES);
      const client = clients.find(
        (c) => c.Username === username && c.Password === password
      );

      if (client) {
        localStorage.setItem('user', JSON.stringify(client));
        router.push('/dashboard');
      } else {
        setError('Credenciales incorrectas. Por favor intente de nuevo.');
      }
    } catch {
      setError('Error al conectar con el servidor. Intente más tarde.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex-center" style={{ minHeight: '100vh', padding: '1rem' }}>
      <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '420px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Maslogistica</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Ingresa tus credenciales para cotizar</p>
        </div>

        <form onSubmit={handleLogin}>
          <div className="input-group">
            <label htmlFor="username">Usuario</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Nombre de empresa"
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <p style={{ color: 'var(--error)', fontSize: '0.875rem', marginBottom: '1rem', textAlign: 'center' }}>
              {error}
            </p>
          )}

          <button type="submit" id="btn-login" disabled={loading}>
            {loading ? 'Verificando...' : 'Iniciar Sesión'}
          </button>
        </form>

        {/* Chat mode CTA */}
        <div style={{ marginTop: '1rem' }}>
          <a
            id="btn-chat-mode"
            href="/chat"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              width: '100%',
              padding: '0.875rem',
              background: 'rgba(140, 198, 63, 0.12)',
              border: '1px solid rgba(140, 198, 63, 0.4)',
              borderRadius: '0.75rem',
              color: '#7bb535',
              fontWeight: 600,
              fontSize: '0.9rem',
              textDecoration: 'none',
              transition: 'all 0.3s ease',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(140, 198, 63, 0.22)';
              (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(140, 198, 63, 0.12)';
              (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)';
            }}
          >
            💬 Probar versión conversacional
          </a>
        </div>

        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          &copy; {new Date().getFullYear()} Maslogistica S.A.S - Todos los derechos reservados.
        </div>
      </div>
    </main>
  );
}
