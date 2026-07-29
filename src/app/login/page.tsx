import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;

  return (
    <div className="container" style={{ maxWidth: 400, paddingTop: 80 }}>
      <div className="card">
        <h1>Portal do Fornecedor</h1>
        <p className="muted">Capital da Lingerie</p>

        <form action={login}>
          <label htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" required autoComplete="email" />

          <label htmlFor="password">Senha</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />

          {erro && <p className="error">{erro}</p>}

          <button type="submit" style={{ width: "100%", marginTop: 20 }}>
            Entrar
          </button>
        </form>

        <p className="muted" style={{ marginTop: 16 }}>
          Acesso liberado pela Capital/Sewe. Em caso de problema, fale com o suporte.
        </p>
      </div>
    </div>
  );
}
